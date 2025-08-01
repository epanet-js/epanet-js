import { LineString, Feature, Position } from "@turf/helpers";
import lineSegment from "@turf/line-segment";
import bbox from "@turf/bbox";
import Flatbush from "flatbush";
import { Pipe } from "../../asset-types/pipe";
import { HydraulicModel } from "../../hydraulic-model";
import { AllocationRule } from "./allocate-customer-points";
import { Asset, NodeAsset, NodeType } from "src/hydraulic-model/asset-types";

export interface LinkSegmentProperties {
  linkId: string;
}

export type LinkSegment = Feature<LineString, LinkSegmentProperties>;

const NODE_TYPE_TO_ENUM = {
  junction: 0,
  reservoir: 1,
  tank: 2,
} as const;

const ENUM_TO_NODE_TYPE = {
  0: "junction" as const,
  1: "reservoir" as const,
  2: "tank" as const,
} as const;

export interface WorkerSpatialData {
  flatbushIndexData: SharedArrayBuffer;
  segmentsData: SharedArrayBuffer;
  pipesData: SharedArrayBuffer;
  nodesData: SharedArrayBuffer;
}

const BUFFER_HEADER_SIZE = 8;
const SEGMENT_BINARY_SIZE = 36;
const PIPE_BINARY_SIZE = 16;
const NODE_BINARY_SIZE = 52;
const NODE_ID_MAX_LENGTH = 32;
const UINT32_SIZE = 4;
const FLOAT64_SIZE = 8;
const FLATBUSH_NODE_SIZE = 16;
const COORDINATES_PER_SEGMENT = 2;

const getSegmentOffset = (index: number): number => {
  return BUFFER_HEADER_SIZE + index * SEGMENT_BINARY_SIZE;
};

const getPipeIndexOffset = (index: number): number => {
  return getSegmentOffset(index);
};

const getCoordinatesOffset = (index: number): number => {
  return getSegmentOffset(index) + UINT32_SIZE;
};

export const getSegmentCoordinates = (
  segmentsData: SharedArrayBuffer,
  index: number,
): Position[] => {
  const view = new DataView(segmentsData);
  let offset = getCoordinatesOffset(index);

  const coordinates: Position[] = [];
  for (let i = 0; i < COORDINATES_PER_SEGMENT; i++) {
    const lng = view.getFloat64(offset, true);
    offset += FLOAT64_SIZE;
    const lat = view.getFloat64(offset, true);
    offset += FLOAT64_SIZE;
    coordinates.push([lng, lat]);
  }

  return coordinates;
};

export const getSegmentPipeIndex = (
  segmentsData: SharedArrayBuffer,
  index: number,
): number => {
  const view = new DataView(segmentsData);
  const offset = getPipeIndexOffset(index);
  return view.getUint32(offset, true);
};

export const getPipeDiameter = (
  pipesData: SharedArrayBuffer,
  index: number,
): number => {
  const view = new DataView(pipesData);
  const offset = BUFFER_HEADER_SIZE + index * PIPE_BINARY_SIZE;
  return view.getFloat64(offset, true);
};

export const getPipeStartNodeIndex = (
  pipesData: SharedArrayBuffer,
  index: number,
): number => {
  const view = new DataView(pipesData);
  const offset = BUFFER_HEADER_SIZE + index * PIPE_BINARY_SIZE + FLOAT64_SIZE;
  return view.getUint32(offset, true);
};

export const getPipeEndNodeIndex = (
  pipesData: SharedArrayBuffer,
  index: number,
): number => {
  const view = new DataView(pipesData);
  const offset =
    BUFFER_HEADER_SIZE + index * PIPE_BINARY_SIZE + FLOAT64_SIZE + UINT32_SIZE;
  return view.getUint32(offset, true);
};

export const getNodeCoordinates = (
  nodesData: SharedArrayBuffer,
  index: number,
): Position => {
  const view = new DataView(nodesData);
  const offset = BUFFER_HEADER_SIZE + index * NODE_BINARY_SIZE;

  const lng = view.getFloat64(offset, true);
  const lat = view.getFloat64(offset + FLOAT64_SIZE, true);

  return [lng, lat];
};

export const getNodeType = (
  nodesData: SharedArrayBuffer,
  index: number,
): NodeType => {
  const view = new DataView(nodesData);
  const offset =
    BUFFER_HEADER_SIZE + index * NODE_BINARY_SIZE + 2 * FLOAT64_SIZE;
  const enumValue = view.getUint32(offset, true);
  return ENUM_TO_NODE_TYPE[enumValue as keyof typeof ENUM_TO_NODE_TYPE];
};

export const getNodeId = (
  nodesData: SharedArrayBuffer,
  index: number,
): string => {
  const offset =
    BUFFER_HEADER_SIZE +
    index * NODE_BINARY_SIZE +
    2 * FLOAT64_SIZE +
    UINT32_SIZE;
  const idBytes = new Uint8Array(nodesData, offset, NODE_ID_MAX_LENGTH);
  const nullIndex = idBytes.indexOf(0);
  const actualLength = nullIndex >= 0 ? nullIndex : NODE_ID_MAX_LENGTH;
  const actualBytes = idBytes.slice(0, actualLength);
  const decoder = new TextDecoder();
  return decoder.decode(actualBytes);
};

export const prepareWorkerData = (
  hydraulicModel: HydraulicModel,
  _allocationRules: AllocationRule[],
): WorkerSpatialData => {
  const { pipesIndex, pipesCount, pipeSegmentsCount, nodesIndex, nodesCount } =
    generateAssetIndexes(Array.from(hydraulicModel.assets.values()));

  const segmentsBuilder = new SegmentsBinaryBuilder(
    pipeSegmentsCount,
    pipesIndex,
  );
  const pipesBuilder = new PipesBinaryBuilder(
    pipesCount,
    pipesIndex,
    nodesIndex,
  );
  const nodesBuilder = new NodesBinaryBuilder(nodesCount, nodesIndex);
  const spatialIndex = new Flatbush(
    pipeSegmentsCount,
    FLATBUSH_NODE_SIZE,
    Float64Array,
    SharedArrayBuffer,
  );

  for (const asset of hydraulicModel.assets.values()) {
    if (asset.isLink && asset.type === "pipe") {
      const pipe = asset as Pipe;
      const [startNodeId, endNodeId] = pipe.connections;
      pipesBuilder.addPipe(pipe.id, pipe.diameter, startNodeId, endNodeId);

      if (pipe.feature.geometry.type === "LineString") {
        const pipeFeature = {
          type: "Feature" as const,
          geometry: pipe.feature.geometry as LineString,
          properties: {},
        };
        const segments = lineSegment(pipeFeature);
        for (const segment of segments.features) {
          const coordinates = segment.geometry.coordinates;
          segmentsBuilder.addSegment(coordinates, pipe.id);

          const [minX, minY, maxX, maxY] = bbox(segment);
          spatialIndex.add(minX, minY, maxX, maxY);
        }
      }
    } else if (asset.isNode) {
      const node = asset as NodeAsset;
      nodesBuilder.addNode(node.id, node.coordinates, node.type as NodeType);
    }
  }

  spatialIndex.finish();

  return {
    flatbushIndexData: spatialIndex.data as SharedArrayBuffer,
    segmentsData: segmentsBuilder.build(),
    pipesData: pipesBuilder.build(),
    nodesData: nodesBuilder.build(),
  };
};

class SegmentsBinaryBuilder {
  private buffer: SharedArrayBuffer;
  private view: DataView;
  private segmentIndex: number = 0;

  constructor(
    segmentCount: number,
    private pipesIndex: Map<string, number>,
  ) {
    const totalSize = BUFFER_HEADER_SIZE + segmentCount * SEGMENT_BINARY_SIZE;
    this.buffer = new SharedArrayBuffer(totalSize);
    this.view = new DataView(this.buffer);

    let offset = 0;
    this.view.setUint32(offset, segmentCount, true);
    offset += UINT32_SIZE;
    this.view.setUint32(offset, 0, true);
  }

  addSegment(coordinates: Position[], pipeId: string): void {
    const pipeIndex = this.pipesIndex.get(pipeId)!;
    let offset = BUFFER_HEADER_SIZE + this.segmentIndex * SEGMENT_BINARY_SIZE;

    this.view.setUint32(offset, pipeIndex, true);
    offset += UINT32_SIZE;

    for (const coord of coordinates) {
      this.view.setFloat64(offset, coord[0], true);
      offset += FLOAT64_SIZE;
      this.view.setFloat64(offset, coord[1], true);
      offset += FLOAT64_SIZE;
    }

    this.segmentIndex++;
  }

  build(): SharedArrayBuffer {
    return this.buffer;
  }
}

class PipesBinaryBuilder {
  private buffer: SharedArrayBuffer;
  private view: DataView;

  constructor(
    pipeCount: number,
    private pipesIndex: Map<string, number>,
    private nodesIndex: Map<string, number>,
  ) {
    const totalSize = BUFFER_HEADER_SIZE + pipeCount * PIPE_BINARY_SIZE;
    this.buffer = new SharedArrayBuffer(totalSize);
    this.view = new DataView(this.buffer);

    let offset = 0;
    this.view.setUint32(offset, pipeCount, true);
    offset += UINT32_SIZE;
    this.view.setUint32(offset, 0, true);
  }

  addPipe(
    pipeId: string,
    diameter: number,
    startNodeId: string,
    endNodeId: string,
  ): void {
    const index = this.pipesIndex.get(pipeId)!;
    const startNodeIndex = this.nodesIndex.get(startNodeId)!;
    const endNodeIndex = this.nodesIndex.get(endNodeId)!;

    let offset = BUFFER_HEADER_SIZE + index * PIPE_BINARY_SIZE;

    this.view.setFloat64(offset, diameter, true);
    offset += FLOAT64_SIZE;
    this.view.setUint32(offset, startNodeIndex, true);
    offset += UINT32_SIZE;
    this.view.setUint32(offset, endNodeIndex, true);
  }

  build(): SharedArrayBuffer {
    return this.buffer;
  }
}

class NodesBinaryBuilder {
  private buffer: SharedArrayBuffer;
  private view: DataView;

  constructor(
    nodeCount: number,
    private nodesIndex: Map<string, number>,
  ) {
    const totalSize = BUFFER_HEADER_SIZE + nodeCount * NODE_BINARY_SIZE;
    this.buffer = new SharedArrayBuffer(totalSize);
    this.view = new DataView(this.buffer);

    let offset = 0;
    this.view.setUint32(offset, nodeCount, true);
    offset += UINT32_SIZE;
    this.view.setUint32(offset, 0, true);
  }

  addNode(nodeId: string, coordinates: Position, nodeType: NodeType): void {
    const index = this.nodesIndex.get(nodeId)!;
    let offset = BUFFER_HEADER_SIZE + index * NODE_BINARY_SIZE;

    this.view.setFloat64(offset, coordinates[0], true);
    offset += FLOAT64_SIZE;
    this.view.setFloat64(offset, coordinates[1], true);
    offset += FLOAT64_SIZE;
    this.view.setUint32(offset, NODE_TYPE_TO_ENUM[nodeType], true);
    offset += UINT32_SIZE;

    const encoder = new TextEncoder();
    const idBytes = encoder.encode(nodeId.slice(0, NODE_ID_MAX_LENGTH));
    const paddedId = new Uint8Array(NODE_ID_MAX_LENGTH);
    paddedId.set(idBytes);

    const uint8View = new Uint8Array(
      this.view.buffer,
      offset,
      NODE_ID_MAX_LENGTH,
    );
    uint8View.set(paddedId);
  }

  build(): SharedArrayBuffer {
    return this.buffer;
  }
}

const generateAssetIndexes = (
  assets: Asset[],
): {
  pipesIndex: Map<string, number>;
  pipesCount: number;
  pipeSegmentsCount: number;
  nodesIndex: Map<string, number>;
  nodesCount: number;
} => {
  const pipesIndex = new Map<string, number>();
  const nodesIndex = new Map<string, number>();
  let pipeIndex = 0;
  let nodeIndex = 0;
  let pipeSegmentsCount = 0;

  for (const asset of assets) {
    if (asset.isLink && asset.type === "pipe") {
      const pipe = asset as Pipe;
      pipesIndex.set(pipe.id, pipeIndex);
      pipeSegmentsCount += pipe.coordinates.length - 1;
      pipeIndex++;
    } else if (asset.isNode) {
      nodesIndex.set(asset.id, nodeIndex);
      nodeIndex++;
    }
  }

  return {
    pipesIndex,
    pipesCount: pipeIndex,
    pipeSegmentsCount,
    nodesIndex,
    nodesCount: nodeIndex,
  };
};
