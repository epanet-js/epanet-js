import { LineString, Feature, Position } from "@turf/helpers";
import lineSegment from "@turf/line-segment";
import bbox from "@turf/bbox";
import Flatbush from "flatbush";
import { Pipe } from "../../asset-types/pipe";
import { HydraulicModel } from "../../hydraulic-model";
import { AllocationRule } from "./types";
import { Asset, NodeAsset, NodeType } from "src/hydraulic-model/asset-types";
import { CustomerPoint } from "../../customer-points";

export interface LinkSegmentProperties {
  linkId: number;
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

export type BinaryData = ArrayBuffer | SharedArrayBuffer;
export interface RunData {
  flatbushIndex: BinaryData;
  segments: BinaryData;
  pipes: BinaryData;
  nodes: BinaryData;
  customerPoints: BinaryData;
}

const BUFFER_HEADER_SIZE = 8;
const SEGMENT_BINARY_SIZE = 36;
const PIPE_BINARY_SIZE = 20; // Changed from 48: UINT32 (id) + FLOAT64 (diameter) + 2*UINT32 (node indices)
const NODE_BINARY_SIZE = 24; // Changed from 52: 2*FLOAT64 (coordinates) + UINT32 (type) + UINT32 (id)
const CUSTOMER_POINT_BINARY_SIZE = 20; // Changed from 48: UINT32 (id) + 2*FLOAT64 (coordinates)
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
  segments: BinaryData,
  index: number,
): Position[] => {
  const view = new DataView(segments);
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
  segments: BinaryData,
  index: number,
): number => {
  const view = new DataView(segments);
  const offset = getPipeIndexOffset(index);
  return view.getUint32(offset, true);
};

export const getPipeId = (pipes: BinaryData, index: number): number => {
  const view = new DataView(pipes);
  const offset = BUFFER_HEADER_SIZE + index * PIPE_BINARY_SIZE;
  return view.getUint32(offset, true);
};

export const getPipeDiameter = (pipes: BinaryData, index: number): number => {
  const view = new DataView(pipes);
  const offset = BUFFER_HEADER_SIZE + index * PIPE_BINARY_SIZE + UINT32_SIZE;
  return view.getFloat64(offset, true);
};

export const getPipeStartNodeIndex = (
  pipes: BinaryData,
  index: number,
): number => {
  const view = new DataView(pipes);
  const offset =
    BUFFER_HEADER_SIZE + index * PIPE_BINARY_SIZE + UINT32_SIZE + FLOAT64_SIZE;
  return view.getUint32(offset, true);
};

export const getPipeEndNodeIndex = (
  pipes: BinaryData,
  index: number,
): number => {
  const view = new DataView(pipes);
  const offset =
    BUFFER_HEADER_SIZE +
    index * PIPE_BINARY_SIZE +
    UINT32_SIZE +
    FLOAT64_SIZE +
    UINT32_SIZE;
  return view.getUint32(offset, true);
};

export const getNodeCoordinates = (
  nodes: BinaryData,
  index: number,
): Position => {
  const view = new DataView(nodes);
  const offset = BUFFER_HEADER_SIZE + index * NODE_BINARY_SIZE;

  const lng = view.getFloat64(offset, true);
  const lat = view.getFloat64(offset + FLOAT64_SIZE, true);

  return [lng, lat];
};

export const getNodeType = (nodes: BinaryData, index: number): NodeType => {
  const view = new DataView(nodes);
  const offset =
    BUFFER_HEADER_SIZE + index * NODE_BINARY_SIZE + 2 * FLOAT64_SIZE;
  const enumValue = view.getUint32(offset, true);
  return ENUM_TO_NODE_TYPE[enumValue as keyof typeof ENUM_TO_NODE_TYPE];
};

export const getNodeId = (nodes: BinaryData, index: number): number => {
  const view = new DataView(nodes);
  const offset =
    BUFFER_HEADER_SIZE +
    index * NODE_BINARY_SIZE +
    2 * FLOAT64_SIZE +
    UINT32_SIZE;
  return view.getUint32(offset, true);
};

export const getCustomerPointCoordinates = (
  customerPoints: BinaryData,
  index: number,
): Position => {
  const view = new DataView(customerPoints);
  const offset =
    BUFFER_HEADER_SIZE + index * CUSTOMER_POINT_BINARY_SIZE + UINT32_SIZE;

  const lng = view.getFloat64(offset, true);
  const lat = view.getFloat64(offset + FLOAT64_SIZE, true);

  return [lng, lat];
};

export const getCustomerPointId = (
  customerPoints: BinaryData,
  index: number,
): number => {
  const view = new DataView(customerPoints);
  const offset = BUFFER_HEADER_SIZE + index * CUSTOMER_POINT_BINARY_SIZE;
  return view.getUint32(offset, true);
};

export const prepareWorkerData = (
  hydraulicModel: HydraulicModel,
  _allocationRules: AllocationRule[],
  customerPoints: CustomerPoint[],
  bufferType: "shared" | "array" = "array",
): RunData => {
  const { pipesIndex, pipesCount, pipeSegmentsCount, nodesIndex, nodesCount } =
    generateAssetIndexes(Array.from(hydraulicModel.assets.values()));

  const customerPointsCount = customerPoints.length;

  const BufferConstructor =
    bufferType === "shared" ? SharedArrayBuffer : ArrayBuffer;

  const segmentsBuilder = new SegmentsBinaryBuilder(
    pipeSegmentsCount,
    pipesIndex,
    bufferType,
  );
  const pipesBuilder = new PipesBinaryBuilder(
    pipesCount,
    pipesIndex,
    nodesIndex,
    bufferType,
  );
  const nodesBuilder = new NodesBinaryBuilder(
    nodesCount,
    nodesIndex,
    bufferType,
  );
  const customerPointsBuilder = new CustomerPointsBinaryBuilder(
    customerPointsCount,
    bufferType,
  );

  // Flatbush requires at least 1 item, so we use a placeholder when no segments exist
  const segmentsForIndex = Math.max(pipeSegmentsCount, 1);
  const spatialIndex = new Flatbush(
    segmentsForIndex,
    FLATBUSH_NODE_SIZE,
    Float64Array,
    BufferConstructor,
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

  for (let i = 0; i < customerPoints.length; i++) {
    const customerPoint = customerPoints[i];
    customerPointsBuilder.addCustomerPoint(
      customerPoint.id,
      customerPoint.coordinates,
      i,
    );
  }

  // Add a placeholder segment if no real segments exist
  if (pipeSegmentsCount === 0) {
    spatialIndex.add(0, 0, 0, 0);
  }

  spatialIndex.finish();

  return {
    flatbushIndex: spatialIndex.data as BinaryData,
    segments: segmentsBuilder.build(),
    pipes: pipesBuilder.build(),
    nodes: nodesBuilder.build(),
    customerPoints: customerPointsBuilder.build(),
  };
};

class SegmentsBinaryBuilder {
  private buffer: BinaryData;
  private view: DataView;
  private segmentIndex: number = 0;

  constructor(
    segmentCount: number,
    private pipesIndex: Map<number, number>,
    private bufferType: "shared" | "array" = "array",
  ) {
    const totalSize = BUFFER_HEADER_SIZE + segmentCount * SEGMENT_BINARY_SIZE;
    this.buffer =
      this.bufferType === "shared"
        ? new SharedArrayBuffer(totalSize)
        : new ArrayBuffer(totalSize);
    this.view = new DataView(this.buffer);

    let offset = 0;
    this.view.setUint32(offset, segmentCount, true);
    offset += UINT32_SIZE;
    this.view.setUint32(offset, 0, true);
  }

  addSegment(coordinates: Position[], pipeId: number): void {
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

  build(): BinaryData {
    return this.buffer;
  }
}

class PipesBinaryBuilder {
  private buffer: BinaryData;
  private view: DataView;

  constructor(
    pipeCount: number,
    private pipesIndex: Map<number, number>,
    private nodesIndex: Map<number, number>,
    private bufferType: "shared" | "array" = "array",
  ) {
    const totalSize = BUFFER_HEADER_SIZE + pipeCount * PIPE_BINARY_SIZE;
    this.buffer =
      this.bufferType === "shared"
        ? new SharedArrayBuffer(totalSize)
        : new ArrayBuffer(totalSize);
    this.view = new DataView(this.buffer);

    let offset = 0;
    this.view.setUint32(offset, pipeCount, true);
    offset += UINT32_SIZE;
    this.view.setUint32(offset, 0, true);
  }

  addPipe(
    pipeId: number,
    diameter: number,
    startNodeId: number,
    endNodeId: number,
  ): void {
    const index = this.pipesIndex.get(pipeId)!;
    const startNodeIndex = this.nodesIndex.get(startNodeId)!;
    const endNodeIndex = this.nodesIndex.get(endNodeId)!;

    let offset = BUFFER_HEADER_SIZE + index * PIPE_BINARY_SIZE;

    // Store pipe ID as UINT32
    this.view.setUint32(offset, pipeId, true);
    offset += UINT32_SIZE;

    this.view.setFloat64(offset, diameter, true);
    offset += FLOAT64_SIZE;
    this.view.setUint32(offset, startNodeIndex, true);
    offset += UINT32_SIZE;
    this.view.setUint32(offset, endNodeIndex, true);
  }

  build(): BinaryData {
    return this.buffer;
  }
}

class NodesBinaryBuilder {
  private buffer: BinaryData;
  private view: DataView;

  constructor(
    nodeCount: number,
    private nodesIndex: Map<number, number>,
    private bufferType: "shared" | "array" = "array",
  ) {
    const totalSize = BUFFER_HEADER_SIZE + nodeCount * NODE_BINARY_SIZE;
    this.buffer =
      this.bufferType === "shared"
        ? new SharedArrayBuffer(totalSize)
        : new ArrayBuffer(totalSize);
    this.view = new DataView(this.buffer);

    let offset = 0;
    this.view.setUint32(offset, nodeCount, true);
    offset += UINT32_SIZE;
    this.view.setUint32(offset, 0, true);
  }

  addNode(nodeId: number, coordinates: Position, nodeType: NodeType): void {
    const index = this.nodesIndex.get(nodeId)!;
    let offset = BUFFER_HEADER_SIZE + index * NODE_BINARY_SIZE;

    this.view.setFloat64(offset, coordinates[0], true);
    offset += FLOAT64_SIZE;
    this.view.setFloat64(offset, coordinates[1], true);
    offset += FLOAT64_SIZE;
    this.view.setUint32(offset, NODE_TYPE_TO_ENUM[nodeType], true);
    offset += UINT32_SIZE;

    // Store node ID as UINT32
    this.view.setUint32(offset, nodeId, true);
  }

  build(): BinaryData {
    return this.buffer;
  }
}

class CustomerPointsBinaryBuilder {
  private buffer: BinaryData;
  private view: DataView;

  constructor(
    customerPointCount: number,
    private bufferType: "shared" | "array" = "array",
  ) {
    const totalSize =
      BUFFER_HEADER_SIZE + customerPointCount * CUSTOMER_POINT_BINARY_SIZE;
    this.buffer =
      this.bufferType === "shared"
        ? new SharedArrayBuffer(totalSize)
        : new ArrayBuffer(totalSize);
    this.view = new DataView(this.buffer);

    let offset = 0;
    this.view.setUint32(offset, customerPointCount, true);
    offset += UINT32_SIZE;
    this.view.setUint32(offset, 0, true);
  }

  addCustomerPoint(
    customerPointId: number,
    coordinates: Position,
    index: number,
  ): void {
    let offset = BUFFER_HEADER_SIZE + index * CUSTOMER_POINT_BINARY_SIZE;

    // Store customer point ID as UINT32
    this.view.setUint32(offset, customerPointId, true);
    offset += UINT32_SIZE;

    this.view.setFloat64(offset, coordinates[0], true);
    offset += FLOAT64_SIZE;
    this.view.setFloat64(offset, coordinates[1], true);
  }

  build(): BinaryData {
    return this.buffer;
  }
}

const generateAssetIndexes = (
  assets: Asset[],
): {
  pipesIndex: Map<number, number>;
  pipesCount: number;
  pipeSegmentsCount: number;
  nodesIndex: Map<number, number>;
  nodesCount: number;
} => {
  const pipesIndex = new Map<number, number>();
  const nodesIndex = new Map<number, number>();
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
