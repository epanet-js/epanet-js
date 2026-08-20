import Flatbush from "flatbush";
import type { Position, MultiPolygon } from "geojson";
import type { NodeType } from "@epanet-js/hydraulic-model";

export const NODE_TYPE_TO_ENUM = {
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
  pipeSegments: BinaryData;
  pipes: BinaryData;
  nodes: BinaryData;
  customerPoints: BinaryData;
  zoneGeometry?: BinaryData;
}

export const BUFFER_HEADER_SIZE = 8;
export const PIPE_SEGMENT_BINARY_SIZE = 36;
export const PIPE_BINARY_SIZE = 20;
export const NODE_BINARY_SIZE = 24;
export const CUSTOMER_POINT_BINARY_SIZE = 20;
export const UINT32_SIZE = 4;
export const FLOAT64_SIZE = 8;
export const FLATBUSH_NODE_SIZE = 16;

const readCount = (view: DataView): number => view.getUint32(0, true);

export class PipeSegmentsView {
  private view: DataView;
  readonly count: number;

  constructor(buffer: BinaryData) {
    this.view = new DataView(buffer);
    this.count = readCount(this.view);
  }

  getPipeIndex(index: number): number {
    return this.view.getUint32(this.offsetOf(index), true);
  }

  getStartLongitude(index: number): number {
    return this.view.getFloat64(this.coordinatesOffsetOf(index), true);
  }

  getStartLatitude(index: number): number {
    return this.view.getFloat64(
      this.coordinatesOffsetOf(index) + FLOAT64_SIZE,
      true,
    );
  }

  getEndLongitude(index: number): number {
    return this.view.getFloat64(
      this.coordinatesOffsetOf(index) + 2 * FLOAT64_SIZE,
      true,
    );
  }

  getEndLatitude(index: number): number {
    return this.view.getFloat64(
      this.coordinatesOffsetOf(index) + 3 * FLOAT64_SIZE,
      true,
    );
  }

  getCoordinates(index: number): Position[] {
    return [
      [this.getStartLongitude(index), this.getStartLatitude(index)],
      [this.getEndLongitude(index), this.getEndLatitude(index)],
    ];
  }

  private offsetOf(index: number): number {
    return BUFFER_HEADER_SIZE + index * PIPE_SEGMENT_BINARY_SIZE;
  }

  private coordinatesOffsetOf(index: number): number {
    return this.offsetOf(index) + UINT32_SIZE;
  }
}

export class PipesView {
  private view: DataView;
  readonly count: number;

  constructor(buffer: BinaryData) {
    this.view = new DataView(buffer);
    this.count = readCount(this.view);
  }

  getId(index: number): number {
    return this.view.getUint32(this.offsetOf(index), true);
  }

  getDiameter(index: number): number {
    return this.view.getFloat64(this.offsetOf(index) + UINT32_SIZE, true);
  }

  getStartNodeIndex(index: number): number {
    return this.view.getUint32(
      this.offsetOf(index) + UINT32_SIZE + FLOAT64_SIZE,
      true,
    );
  }

  getEndNodeIndex(index: number): number {
    return this.view.getUint32(
      this.offsetOf(index) + 2 * UINT32_SIZE + FLOAT64_SIZE,
      true,
    );
  }

  private offsetOf(index: number): number {
    return BUFFER_HEADER_SIZE + index * PIPE_BINARY_SIZE;
  }
}

export class NodesView {
  private view: DataView;
  readonly count: number;

  constructor(buffer: BinaryData) {
    this.view = new DataView(buffer);
    this.count = readCount(this.view);
  }

  getCoordinates(index: number): Position {
    const offset = this.offsetOf(index);
    return [
      this.view.getFloat64(offset, true),
      this.view.getFloat64(offset + FLOAT64_SIZE, true),
    ];
  }

  getType(index: number): NodeType {
    const enumValue = this.view.getUint32(
      this.offsetOf(index) + 2 * FLOAT64_SIZE,
      true,
    );
    return ENUM_TO_NODE_TYPE[enumValue as keyof typeof ENUM_TO_NODE_TYPE];
  }

  getId(index: number): number {
    return this.view.getUint32(
      this.offsetOf(index) + 2 * FLOAT64_SIZE + UINT32_SIZE,
      true,
    );
  }

  private offsetOf(index: number): number {
    return BUFFER_HEADER_SIZE + index * NODE_BINARY_SIZE;
  }
}

export class CustomerPointsView {
  private view: DataView;
  readonly count: number;

  constructor(buffer: BinaryData) {
    this.view = new DataView(buffer);
    this.count = readCount(this.view);
  }

  getId(index: number): number {
    return this.view.getUint32(this.offsetOf(index), true);
  }

  getCoordinates(index: number): Position {
    const offset = this.offsetOf(index) + UINT32_SIZE;
    return [
      this.view.getFloat64(offset, true),
      this.view.getFloat64(offset + FLOAT64_SIZE, true),
    ];
  }

  private offsetOf(index: number): number {
    return BUFFER_HEADER_SIZE + index * CUSTOMER_POINT_BINARY_SIZE;
  }
}

// The decoded geometry carries its bounding box so point-in-polygon tests can
// reject points outside it with four comparisons instead of walking every ring.
export const deserializeZoneGeometry = (buffer: BinaryData): MultiPolygon => {
  const view = new DataView(buffer);
  let offset = 0;

  const polygonCount = view.getUint32(offset, true);
  offset += UINT32_SIZE;
  offset += UINT32_SIZE;

  const coordinates: Position[][][] = [];
  let minLongitude = Infinity;
  let minLatitude = Infinity;
  let maxLongitude = -Infinity;
  let maxLatitude = -Infinity;

  for (let p = 0; p < polygonCount; p++) {
    const ringCount = view.getUint32(offset, true);
    offset += UINT32_SIZE;

    const polygon: Position[][] = [];
    for (let r = 0; r < ringCount; r++) {
      const positionCount = view.getUint32(offset, true);
      offset += UINT32_SIZE;

      const ring: Position[] = [];
      for (let n = 0; n < positionCount; n++) {
        const lng = view.getFloat64(offset, true);
        offset += FLOAT64_SIZE;
        const lat = view.getFloat64(offset, true);
        offset += FLOAT64_SIZE;

        if (lng < minLongitude) minLongitude = lng;
        if (lng > maxLongitude) maxLongitude = lng;
        if (lat < minLatitude) minLatitude = lat;
        if (lat > maxLatitude) maxLatitude = lat;

        ring.push([lng, lat]);
      }
      polygon.push(ring);
    }
    coordinates.push(polygon);
  }

  return {
    type: "MultiPolygon",
    coordinates,
    bbox: [minLongitude, minLatitude, maxLongitude, maxLatitude],
  };
};

export class RunDataView {
  readonly spatialIndex: Flatbush;
  readonly pipeSegments: PipeSegmentsView;
  readonly pipes: PipesView;
  readonly nodes: NodesView;
  readonly customerPoints: CustomerPointsView;
  readonly zoneGeometry: MultiPolygon | undefined;

  constructor(data: RunData) {
    this.spatialIndex = Flatbush.from(data.flatbushIndex);
    this.pipeSegments = new PipeSegmentsView(data.pipeSegments);
    this.pipes = new PipesView(data.pipes);
    this.nodes = new NodesView(data.nodes);
    this.customerPoints = new CustomerPointsView(data.customerPoints);
    this.zoneGeometry = data.zoneGeometry
      ? deserializeZoneGeometry(data.zoneGeometry)
      : undefined;
  }
}
