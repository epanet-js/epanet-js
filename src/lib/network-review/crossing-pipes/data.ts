import { Pipe, AssetId } from "src/hydraulic-model/asset-types";
import { HydraulicModel } from "src/hydraulic-model";
import { Position } from "geojson";
import lineSegment from "@turf/line-segment";
import Flatbush from "flatbush";
import bbox from "@turf/bbox";
import { lineString } from "@turf/helpers";

export type BinaryData = ArrayBuffer | SharedArrayBuffer;

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
  distanceToNearestJunction: number;
}

export type EncodedCrossingPipes = EncodedCrossingPipe[];

export interface CrossingPipe {
  pipe1Id: AssetId;
  pipe2Id: AssetId;
  intersectionPoint: Position;
  distanceToNearestJunction: number;
}

const UINT32_SIZE = 4;
const FLOAT64_SIZE = 8;
const COORDINATES_SIZE = 2 * FLOAT64_SIZE;
const BUFFER_HEADER_SIZE = UINT32_SIZE;
const NODE_BINARY_SIZE = UINT32_SIZE + COORDINATES_SIZE;
const PIPE_BINARY_SIZE = UINT32_SIZE * 3 + COORDINATES_SIZE * 2; // id, start, end, startPos, endPos
const SEGMENT_BINARY_SIZE = UINT32_SIZE + COORDINATES_SIZE * 2;

export function encodeHydraulicModel(
  model: HydraulicModel,
  bufferType: "shared" | "array" = "array",
): EncodedHydraulicModel {
  const idsLookup: string[] = [];
  const idxLookup = new Map<string, number>(); // string ID → numeric index

  const getOrAssignIdx = (id: string) => {
    let idx = idxLookup.get(id);
    if (idx === undefined) {
      idx = idsLookup.length;
      idxLookup.set(id, idx);
      idsLookup.push(id);
    }
    return idx;
  };

  const nodes: { id: number; position: Position }[] = [];
  const pipes: {
    id: number;
    start: number;
    end: number;
    startPosition: Position;
    endPosition: Position;
  }[] = [];
  const pipeSegments: {
    pipeId: number;
    startPosition: Position;
    endPosition: Position;
  }[] = [];

  for (const [id, asset] of model.assets) {
    const idx = getOrAssignIdx(id);

    if (asset.isLink && asset.type === "pipe") {
      const pipe = asset as Pipe;
      const [startId, endId] = pipe.connections;
      const start = getOrAssignIdx(startId);
      const end = getOrAssignIdx(endId);

      const startNode = model.assets.get(startId);
      const endNode = model.assets.get(endId);

      if (
        startNode &&
        !startNode.isLink &&
        endNode &&
        !endNode.isLink &&
        pipe.feature.geometry.type === "LineString"
      ) {
        const startGeometry = startNode.feature.geometry as GeoJSON.Point;
        const endGeometry = endNode.feature.geometry as GeoJSON.Point;

        pipes.push({
          id: idx,
          start,
          end,
          startPosition: startGeometry.coordinates,
          endPosition: endGeometry.coordinates,
        });

        // Create pipe segments for spatial indexing
        const pipeFeature = {
          type: "Feature" as const,
          geometry: pipe.feature.geometry,
          properties: {},
        };
        const segments = lineSegment(pipeFeature);
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

  function encodeNodes(nodes: { id: number; position: Position }[]): {
    buffer: BinaryData;
    geoIndex: BinaryData;
  } {
    const recordSize = NODE_BINARY_SIZE;
    const totalSize = BUFFER_HEADER_SIZE + nodes.length * recordSize;
    const buffer =
      bufferType === "shared"
        ? new SharedArrayBuffer(totalSize)
        : new ArrayBuffer(totalSize);
    const geoIndex = new Flatbush(Math.max(nodes.length, 1));

    const view = new DataView(buffer);
    view.setUint32(0, nodes.length, true);
    nodes.forEach((n, i) => {
      let offset = UINT32_SIZE + i * recordSize;
      view.setUint32(offset, n.id, true);
      offset += UINT32_SIZE;
      encodeCoordinates([n.position], offset, view);

      // Add to spatial index (point has same min/max)
      const [lon, lat] = n.position;
      geoIndex.add(lon, lat, lon, lat);
    });

    if (nodes.length === 0) {
      geoIndex.add(0, 0, 0, 0);
    }

    geoIndex.finish();

    return { buffer, geoIndex: geoIndex.data };
  }

  function encodePipes(
    pipes: {
      id: number;
      start: number;
      end: number;
      startPosition: Position;
      endPosition: Position;
    }[],
  ): BinaryData {
    const recordSize = PIPE_BINARY_SIZE;
    const totalSize = BUFFER_HEADER_SIZE + pipes.length * recordSize;
    const buffer =
      bufferType === "shared"
        ? new SharedArrayBuffer(totalSize)
        : new ArrayBuffer(totalSize);

    const view = new DataView(buffer);
    view.setUint32(0, pipes.length, true);
    pipes.forEach((p, i) => {
      let offset = UINT32_SIZE + i * recordSize;
      view.setUint32(offset, p.id, true);
      offset += UINT32_SIZE;
      view.setUint32(offset, p.start, true);
      offset += UINT32_SIZE;
      view.setUint32(offset, p.end, true);
      offset += UINT32_SIZE;
      encodeCoordinates([p.startPosition, p.endPosition], offset, view);
    });
    return buffer;
  }

  function encodePipeSegments(
    segments: {
      pipeId: number;
      startPosition: Position;
      endPosition: Position;
    }[],
  ): {
    buffer: BinaryData;
    geoIndex: BinaryData;
  } {
    const count = segments.length;
    const recordSize = SEGMENT_BINARY_SIZE;
    const totalSize = BUFFER_HEADER_SIZE + count * recordSize;
    const buffer =
      bufferType === "shared"
        ? new SharedArrayBuffer(totalSize)
        : new ArrayBuffer(totalSize);
    const geoIndex = new Flatbush(Math.max(count, 1));

    const view = new DataView(buffer);
    view.setUint32(0, segments.length, true);

    segments.forEach((segment, i) => {
      let offset = UINT32_SIZE + i * recordSize;
      view.setUint32(offset, segment.pipeId, true);
      offset += UINT32_SIZE;
      encodeCoordinates(
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

  function encodeCoordinates(
    coordinates: Position[],
    offset: number,
    view: DataView,
  ): void {
    coordinates.forEach((coord, i) => {
      const coordOffset = offset + i * COORDINATES_SIZE;
      view.setFloat64(coordOffset, coord[0], true);
      view.setFloat64(coordOffset + FLOAT64_SIZE, coord[1], true);
    });
  }

  const { buffer: pipeSegmentsBuffer, geoIndex: pipeSegmentsGeoIndex } =
    encodePipeSegments(pipeSegments);
  const { buffer: nodeBuffer, geoIndex: nodeGeoIndex } = encodeNodes(nodes);

  return {
    nodeBuffer,
    nodeGeoIndex,
    pipeBuffer: encodePipes(pipes),
    pipeSegmentsBuffer,
    pipeSegmentsGeoIndex,
    idsLookup: idsLookup,
  };
}

export function decodeCrossingPipes(
  model: HydraulicModel,
  idsLookup: string[],
  encodedCrossingPipes: EncodedCrossingPipes,
): CrossingPipe[] {
  const crossingPipes: CrossingPipe[] = [];

  encodedCrossingPipes.forEach((encoded) => {
    const pipe1Id = idsLookup[encoded.pipe1Id];
    const pipe2Id = idsLookup[encoded.pipe2Id];
    const pipe1Asset = model.assets.get(pipe1Id);
    const pipe2Asset = model.assets.get(pipe2Id);

    if (
      pipe1Asset &&
      pipe1Asset.type === "pipe" &&
      pipe2Asset &&
      pipe2Asset.type === "pipe"
    ) {
      crossingPipes.push({
        pipe1Id,
        pipe2Id,
        intersectionPoint: encoded.intersectionPoint,
        distanceToNearestJunction: encoded.distanceToNearestJunction,
      });
    }
  });

  // Sort by distance to nearest junction (descending - worst cases first)
  return crossingPipes.sort((a, b) => {
    if (a.distanceToNearestJunction !== b.distanceToNearestJunction) {
      return b.distanceToNearestJunction - a.distanceToNearestJunction;
    }

    const pipe1A = model.assets.get(a.pipe1Id);
    const pipe1B = model.assets.get(b.pipe1Id);
    const labelA = pipe1A
      ? pipe1A.label.toUpperCase()
      : a.pipe1Id.toUpperCase();
    const labelB = pipe1B
      ? pipe1B.label.toUpperCase()
      : b.pipe1Id.toUpperCase();

    return labelA < labelB ? -1 : labelA > labelB ? 1 : 0;
  });
}

export interface Node {
  id: number;
  position: Position;
}

export interface PipeData {
  id: number;
  startNode: number;
  endNode: number;
  startPosition: Position;
  endPosition: Position;
}

export class PipeBufferView {
  private view: DataView;
  readonly count: number;

  constructor(public readonly buffer: BinaryData) {
    this.view = new DataView(buffer);
    this.count = this.decodeCount(this.view);
  }

  private decodeCount(view: DataView): number {
    return view.getUint32(0, true);
  }

  *pipes(): Generator<PipeData> {
    for (let i = 0; i < this.count; i++) {
      yield this.decodePipe(this.view, i);
    }
  }

  private decodePipe(view: DataView, index: number): PipeData {
    let offset = BUFFER_HEADER_SIZE + index * PIPE_BINARY_SIZE;
    const id = view.getUint32(offset, true);
    offset += UINT32_SIZE;
    const startNode = view.getUint32(offset, true);
    offset += UINT32_SIZE;
    const endNode = view.getUint32(offset, true);
    offset += UINT32_SIZE;
    const startPosition: Position = [
      view.getFloat64(offset, true),
      view.getFloat64(offset + FLOAT64_SIZE, true),
    ];
    offset += COORDINATES_SIZE;
    const endPosition: Position = [
      view.getFloat64(offset, true),
      view.getFloat64(offset + FLOAT64_SIZE, true),
    ];
    return {
      id,
      startNode,
      endNode,
      startPosition,
      endPosition,
    };
  }
}

export class NodeBufferView {
  private view: DataView;
  readonly count: number;

  constructor(public readonly buffer: BinaryData) {
    this.view = new DataView(buffer);
    this.count = this.decodeCount(this.view);
  }

  private decodeCount(view: DataView): number {
    return view.getUint32(0, true);
  }

  *nodes(): Generator<Node> {
    for (let i = 0; i < this.count; i++) {
      yield this.decodeNode(this.view, i);
    }
  }

  private decodeNode(view: DataView, index: number): Node {
    let offset = BUFFER_HEADER_SIZE + index * NODE_BINARY_SIZE;
    const id = view.getUint32(offset, true);
    offset += UINT32_SIZE;
    const position: Position = [
      view.getFloat64(offset, true),
      view.getFloat64(offset + FLOAT64_SIZE, true),
    ];
    return { id, position };
  }
}

export class SegmentsGeometriesBufferView {
  private view: DataView;
  readonly count: number;

  constructor(public readonly buffer: BinaryData) {
    this.view = new DataView(buffer);
    this.count = this.decodeCount(this.view);
  }

  private decodeCount(view: DataView): number {
    return view.getUint32(0, true);
  }

  getId(index: number): number {
    const id = this.view.getUint32(
      BUFFER_HEADER_SIZE + index * SEGMENT_BINARY_SIZE,
      true,
    );
    return id;
  }

  getCoordinates(index: number): [Position, Position] {
    const offset =
      BUFFER_HEADER_SIZE + index * SEGMENT_BINARY_SIZE + UINT32_SIZE;
    const startPosition: Position = [
      this.view.getFloat64(offset, true),
      this.view.getFloat64(offset + FLOAT64_SIZE, true),
    ];
    const endPosition: Position = [
      this.view.getFloat64(offset + COORDINATES_SIZE, true),
      this.view.getFloat64(offset + COORDINATES_SIZE + FLOAT64_SIZE, true),
    ];
    return [startPosition, endPosition];
  }
}
