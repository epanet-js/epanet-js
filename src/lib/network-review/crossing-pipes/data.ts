import { Pipe, AssetId } from "src/hydraulic-model/asset-types";
import { HydraulicModel } from "src/hydraulic-model";
import { Position } from "geojson";
import lineSegment from "@turf/line-segment";
import Flatbush from "flatbush";
import bbox from "@turf/bbox";
import { lineString } from "@turf/helpers";
import {
  BinaryData,
  BufferType,
  IdMapper,
  EncodedSize,
  createBuffer,
  encodeCount,
  decodeCount,
  encodePosition,
  decodePosition,
  encodeLineCoordinates,
  encodeId,
  decodeId,
  encodeBounds,
  decodeBounds,
} from "../shared";

export type EncodedHydraulicModel = {
  nodeBuffer: BinaryData;
  nodeGeoIndex: BinaryData;
  pipeBuffer: BinaryData;
  pipeSegmentsBuffer: BinaryData;
  pipeSegmentsGeoIndex: BinaryData;
  idsLookup: string[];
};

export type RunData = Omit<EncodedHydraulicModel, "idsLookup">;

interface EncodedCrossingPipe {
  pipe1Id: number;
  pipe2Id: number;
  intersectionPoint: Position;
}

export type EncodedCrossingPipes = EncodedCrossingPipe[];

export interface CrossingPipe {
  pipe1Id: AssetId;
  pipe2Id: AssetId;
  intersectionPoint: Position;
}

const NODE_BINARY_SIZE = EncodedSize.id + EncodedSize.position;
const PIPE_BINARY_SIZE = EncodedSize.id * 3 + EncodedSize.position * 2;
const SEGMENT_BINARY_SIZE = EncodedSize.id + EncodedSize.position * 2;

export function encodeHydraulicModel(
  model: HydraulicModel,
  bufferType: BufferType = "array",
): EncodedHydraulicModel {
  const idMapper = new IdMapper();

  const nodes: { id: number; position: Position }[] = [];
  const pipes: {
    id: number;
    start: number;
    end: number;
    bbox: [Position, Position];
  }[] = [];
  const pipeSegments: {
    pipeId: number;
    startPosition: Position;
    endPosition: Position;
  }[] = [];

  for (const [id, asset] of model.assets) {
    const idx = idMapper.getOrAssignIdx(id);

    if (asset.isLink && asset.type === "pipe") {
      const pipe = asset as Pipe;
      const [startId, endId] = pipe.connections;
      const start = idMapper.getOrAssignIdx(startId);
      const end = idMapper.getOrAssignIdx(endId);

      const startNode = model.assets.get(startId);
      const endNode = model.assets.get(endId);

      if (
        startNode &&
        !startNode.isLink &&
        endNode &&
        !endNode.isLink &&
        pipe.feature.geometry.type === "LineString"
      ) {
        const pipeFeature = {
          type: "Feature" as const,
          geometry: pipe.feature.geometry,
          properties: {},
        };
        const segments = lineSegment(pipeFeature);

        const [minX, minY, maxX, maxY] = bbox(pipeFeature);

        pipes.push({
          id: idx,
          start,
          end,
          bbox: [
            [minX, minY],
            [maxX, maxY],
          ],
        });

        for (const segment of segments.features) {
          const [startPosition, endPosition] = segment.geometry.coordinates;
          pipeSegments.push({ pipeId: idx, startPosition, endPosition });
        }
      }
    } else if (!asset.isLink) {
      const geometry = asset.feature.geometry as GeoJSON.Point;
      nodes.push({
        id: idx,
        position: geometry.coordinates,
      });
    }
  }

  const { buffer: pipeSegmentsBuffer, geoIndex: pipeSegmentsGeoIndex } =
    encodePipeSegmentsBuffer(pipeSegments, bufferType);
  const { buffer: nodeBuffer, geoIndex: nodeGeoIndex } = encodeNodesBuffer(
    nodes,
    bufferType,
  );

  return {
    nodeBuffer,
    nodeGeoIndex,
    pipeBuffer: encodePipesBuffer(pipes, bufferType),
    pipeSegmentsBuffer,
    pipeSegmentsGeoIndex,
    idsLookup: idMapper.getIdsLookup(),
  };
}

function encodeNodesBuffer(
  nodes: { id: number; position: Position }[],
  bufferType: BufferType,
): {
  buffer: BinaryData;
  geoIndex: BinaryData;
} {
  const recordSize = NODE_BINARY_SIZE;
  const totalSize = EncodedSize.count + nodes.length * recordSize;
  const buffer = createBuffer(totalSize, bufferType);
  const geoIndex = new Flatbush(Math.max(nodes.length, 1));

  const view = new DataView(buffer);
  encodeCount(view, nodes.length);
  nodes.forEach((n, i) => {
    let offset = EncodedSize.count + i * recordSize;
    encodeId(n.id, offset, view);
    offset += EncodedSize.id;
    encodePosition(n.position, offset, view);

    const [lon, lat] = n.position;
    geoIndex.add(lon, lat, lon, lat);
  });

  if (nodes.length === 0) {
    geoIndex.add(0, 0, 0, 0);
  }

  geoIndex.finish();

  return { buffer, geoIndex: geoIndex.data };
}

function encodePipesBuffer(
  pipes: {
    id: number;
    start: number;
    end: number;
    bbox: [Position, Position];
  }[],
  bufferType: BufferType,
): BinaryData {
  const recordSize = PIPE_BINARY_SIZE;
  const totalSize = EncodedSize.count + pipes.length * recordSize;
  const buffer = createBuffer(totalSize, bufferType);

  const view = new DataView(buffer);
  encodeCount(view, pipes.length);
  pipes.forEach((p, i) => {
    let offset = EncodedSize.count + i * recordSize;
    encodeId(p.id, offset, view);
    offset += EncodedSize.id;
    encodeId(p.start, offset, view);
    offset += EncodedSize.id;
    encodeId(p.end, offset, view);
    offset += EncodedSize.id;
    encodeBounds(
      [p.bbox[0][0], p.bbox[0][1], p.bbox[1][0], p.bbox[1][1]],
      offset,
      view,
    );
  });
  return buffer;
}

function encodePipeSegmentsBuffer(
  segments: {
    pipeId: number;
    startPosition: Position;
    endPosition: Position;
  }[],
  bufferType: BufferType,
): {
  buffer: BinaryData;
  geoIndex: BinaryData;
} {
  const count = segments.length;
  const recordSize = SEGMENT_BINARY_SIZE;
  const totalSize = EncodedSize.count + count * recordSize;
  const buffer = createBuffer(totalSize, bufferType);
  const geoIndex = new Flatbush(Math.max(count, 1));

  const view = new DataView(buffer);
  encodeCount(view, segments.length);

  segments.forEach((segment, i) => {
    let offset = EncodedSize.count + i * recordSize;
    encodeId(segment.pipeId, offset, view);
    offset += EncodedSize.id;
    encodeLineCoordinates(
      [segment.startPosition, segment.endPosition],
      offset,
      view,
    );

    const [minX, minY, maxX, maxY] = bbox(
      lineString([segment.startPosition, segment.endPosition]),
    );
    geoIndex.add(minX, minY, maxX, maxY);
  });

  if (count === 0) {
    geoIndex.add(0, 0, 0, 0);
  }

  geoIndex.finish();

  return { buffer, geoIndex: geoIndex.data };
}

export function decodeCrossingPipes(
  model: HydraulicModel,
  idsLookup: string[],
  encodedCrossingPipes: EncodedCrossingPipes,
): CrossingPipe[] {
  const crossingPipes: CrossingPipe[] = encodedCrossingPipes.map((encoded) => {
    const [pipe1Id, pipe2Id] = sortByDiameterAndLabel(
      model,
      idsLookup[encoded.pipe1Id],
      idsLookup[encoded.pipe2Id],
    );

    return {
      pipe1Id,
      pipe2Id,
      intersectionPoint: encoded.intersectionPoint,
    };
  });

  return crossingPipes.sort((a, b) => {
    const pipe1A = model.assets.get(a.pipe1Id) as Pipe;
    const pipe2A = model.assets.get(a.pipe2Id) as Pipe;
    const pipe1B = model.assets.get(b.pipe1Id) as Pipe;
    const pipe2B = model.assets.get(b.pipe2Id) as Pipe;

    if (pipe1A.diameter === pipe1B.diameter) {
      if (pipe2A.diameter === pipe2B.diameter) {
        return pipe1A.label.toUpperCase() < pipe1B.label.toUpperCase() ? -1 : 1;
      }
      return pipe2A.diameter - pipe2B.diameter;
    }
    return pipe1A.diameter - pipe1B.diameter;
  });
}

function sortByDiameterAndLabel(
  model: HydraulicModel,
  pipeAId: AssetId,
  pipeBId: AssetId,
): [AssetId, AssetId] {
  const pipeAAsset = model.assets.get(pipeAId);
  const pipeBAsset = model.assets.get(pipeBId);

  const pipeA = pipeAAsset as Pipe;
  const pipeB = pipeBAsset as Pipe;

  if (pipeA.diameter === pipeB.diameter) {
    return pipeA.label.toUpperCase() < pipeB.label.toUpperCase()
      ? [pipeAId, pipeBId]
      : [pipeBId, pipeAId];
  }

  return pipeA.diameter < pipeB.diameter
    ? [pipeAId, pipeBId]
    : [pipeBId, pipeAId];
}

export interface EncodedNode {
  id: number;
  position: Position;
}

export interface EncodedPipe {
  id: number;
  startNode: number;
  endNode: number;
  bbox: [Position, Position];
}

export class PipeBufferView {
  private view: DataView;
  readonly count: number;
  private indexesLookup: Map<number, number> = new Map();

  constructor(public readonly buffer: BinaryData) {
    this.view = new DataView(buffer);
    this.count = decodeCount(this.view);

    for (const [index, pipe] of this.enumerate(this.iter())) {
      this.indexesLookup.set(pipe.id, index);
    }
  }

  *iter(): Generator<EncodedPipe> {
    for (let i = 0; i < this.count; i++) {
      let offset = EncodedSize.count + i * PIPE_BINARY_SIZE;
      const id = decodeId(offset, this.view);
      offset += EncodedSize.id;
      const startNode = decodeId(offset, this.view);
      offset += EncodedSize.id;
      const endNode = decodeId(offset, this.view);
      offset += EncodedSize.id;
      const bounds = decodeBounds(offset, this.view);
      const bboxMin: Position = [bounds[0], bounds[1]];
      const bboxMax: Position = [bounds[2], bounds[3]];
      yield {
        id,
        startNode,
        endNode,
        bbox: [bboxMin, bboxMax],
      };
    }
  }

  getByIndex(pipeId: number): EncodedPipe | null {
    const pipeIndex = this.indexesLookup.get(pipeId);
    if (pipeIndex === undefined) return null;
    let offset = EncodedSize.count + pipeIndex * PIPE_BINARY_SIZE;
    const id = decodeId(offset, this.view);
    offset += EncodedSize.id;
    const startNode = decodeId(offset, this.view);
    offset += EncodedSize.id;
    const endNode = decodeId(offset, this.view);
    offset += EncodedSize.id;
    const bounds = decodeBounds(offset, this.view);
    const bboxMin: Position = [bounds[0], bounds[1]];
    const bboxMax: Position = [bounds[2], bounds[3]];
    return {
      id,
      startNode,
      endNode,
      bbox: [bboxMin, bboxMax],
    };
  }

  private *enumerate<T>(iterable: Iterable<T>): Generator<[number, T]> {
    let i = 0;
    for (const item of iterable) {
      yield [i++, item];
    }
  }
}

export class NodeBufferView {
  private view: DataView;
  readonly count: number;
  private indexesLookup: Map<number, number> = new Map();

  constructor(public readonly buffer: BinaryData) {
    this.view = new DataView(buffer);
    this.count = decodeCount(this.view);

    for (const [index, node] of this.enumerate(this.iter())) {
      this.indexesLookup.set(node.id, index);
    }
  }

  *iter(): Generator<EncodedNode> {
    for (let i = 0; i < this.count; i++) {
      let offset = EncodedSize.count + i * NODE_BINARY_SIZE;
      const id = decodeId(offset, this.view);
      offset += EncodedSize.id;
      const position = decodePosition(offset, this.view);
      yield { id, position };
    }
  }

  private *enumerate<T>(iterable: Iterable<T>): Generator<[number, T]> {
    let i = 0;
    for (const item of iterable) {
      yield [i++, item];
    }
  }

  getByIndex(id: number): EncodedNode | null {
    const nodeIndex = this.indexesLookup.get(id);
    if (nodeIndex === undefined) return null;
    let offset = EncodedSize.count + nodeIndex * NODE_BINARY_SIZE;
    const nodeId = decodeId(offset, this.view);
    offset += EncodedSize.id;
    const position = decodePosition(offset, this.view);
    return { id: nodeId, position };
  }
}

export class SegmentsGeometriesBufferView {
  private view: DataView;
  readonly count: number;

  constructor(public readonly buffer: BinaryData) {
    this.view = new DataView(buffer);
    this.count = decodeCount(this.view);
  }

  getId(index: number): number {
    return decodeId(EncodedSize.count + index * SEGMENT_BINARY_SIZE, this.view);
  }

  getCoordinates(index: number): [Position, Position] {
    let offset =
      EncodedSize.count + index * SEGMENT_BINARY_SIZE + EncodedSize.id;
    const startPosition = decodePosition(offset, this.view);
    offset += EncodedSize.position;
    const endPosition = decodePosition(offset, this.view);
    return [startPosition, endPosition];
  }
}
