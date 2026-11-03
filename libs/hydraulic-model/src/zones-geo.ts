import Flatbush from "flatbush";
import type { Position } from "geojson";
import type { ZoneId, Zones } from "./zones";
import type { SearchOptions } from "./spatial-queries";
import { toSearchPolygon } from "./spatial-queries";
import { BinaryData, BufferType, createBuffer } from "@epanet-js/buffers";

const EDGES_PER_CHUNK = 16;

export type ZonesGeoBuffers = {
  zoneIds: BinaryData;
  zoneBounds: BinaryData;
  zoneRings: BinaryData;
  ringVertices: BinaryData;
  coordinates: BinaryData;
  zonesSpatialIndex: BinaryData;
  chunkFirstVertex: BinaryData;
  chunkEdgeCount: BinaryData;
  chunkZone: BinaryData;
  chunkBounds: BinaryData;
  chunksSpatialIndex: BinaryData;
};

const bufferKeys: (keyof ZonesGeoBuffers)[] = [
  "zoneIds",
  "zoneBounds",
  "zoneRings",
  "ringVertices",
  "coordinates",
  "zonesSpatialIndex",
  "chunkFirstVertex",
  "chunkEdgeCount",
  "chunkZone",
  "chunkBounds",
  "chunksSpatialIndex",
];

export function zonesGeoTransferables(b: ZonesGeoBuffers): ArrayBuffer[] {
  return bufferKeys
    .map((key) => b[key])
    .filter((buf): buf is ArrayBuffer => buf instanceof ArrayBuffer);
}

export function cloneZonesGeoBuffers(b: ZonesGeoBuffers): ZonesGeoBuffers {
  const clone = {} as ZonesGeoBuffers;
  for (const key of bufferKeys) clone[key] = b[key].slice(0);
  return clone;
}

const emptyZonesGeoBuffers = (bufferType: BufferType): ZonesGeoBuffers => {
  const empty = {} as ZonesGeoBuffers;
  for (const key of bufferKeys) empty[key] = createBuffer(0, bufferType);
  return empty;
};

export function encodeZonesGeo(
  zones: Zones,
  bufferType: BufferType = "array",
): ZonesGeoBuffers {
  let zoneCount = 0;
  let ringCount = 0;
  let vertexCount = 0;
  let chunkCount = 0;
  for (const zone of zones.values()) {
    zoneCount++;
    for (const polygon of zone.geometry.coordinates) {
      for (const ring of polygon) {
        ringCount++;
        vertexCount += ring.length;
        chunkCount += Math.ceil(Math.max(0, ring.length - 1) / EDGES_PER_CHUNK);
      }
    }
  }
  if (zoneCount === 0 || chunkCount === 0)
    return emptyZonesGeoBuffers(bufferType);

  const ArrayBufferType =
    bufferType === "shared" ? SharedArrayBuffer : ArrayBuffer;
  const u32 = (length: number) =>
    createBuffer(length * Uint32Array.BYTES_PER_ELEMENT, bufferType);
  const f64 = (length: number) =>
    createBuffer(length * Float64Array.BYTES_PER_ELEMENT, bufferType);

  const buffers: Omit<
    ZonesGeoBuffers,
    "zonesSpatialIndex" | "chunksSpatialIndex"
  > = {
    zoneIds: u32(zoneCount),
    zoneBounds: f64(zoneCount * 4),
    zoneRings: u32(zoneCount + 1),
    ringVertices: u32(ringCount + 1),
    coordinates: f64(vertexCount * 2),
    chunkFirstVertex: u32(chunkCount),
    chunkEdgeCount: createBuffer(chunkCount, bufferType),
    chunkZone: u32(chunkCount),
    chunkBounds: f64(chunkCount * 4),
  };
  const zoneIds = new Uint32Array(buffers.zoneIds);
  const zoneBounds = new Float64Array(buffers.zoneBounds);
  const zoneRings = new Uint32Array(buffers.zoneRings);
  const ringVertices = new Uint32Array(buffers.ringVertices);
  const coordinates = new Float64Array(buffers.coordinates);
  const chunkFirstVertex = new Uint32Array(buffers.chunkFirstVertex);
  const chunkEdgeCount = new Uint8Array(buffers.chunkEdgeCount);
  const chunkZone = new Uint32Array(buffers.chunkZone);
  const chunkBounds = new Float64Array(buffers.chunkBounds);

  const zonesIndex = new Flatbush(
    zoneCount,
    undefined,
    Float64Array,
    ArrayBufferType,
  );
  const chunksIndex = new Flatbush(
    chunkCount,
    undefined,
    Float64Array,
    ArrayBufferType,
  );

  let zoneIndex = 0;
  let ringIndex = 0;
  let vertexIndex = 0;
  let chunkIndex = 0;
  for (const zone of zones.values()) {
    zoneIds[zoneIndex] = zone.id;
    zoneRings[zoneIndex] = ringIndex;
    let zMinX = Infinity;
    let zMinY = Infinity;
    let zMaxX = -Infinity;
    let zMaxY = -Infinity;
    for (const polygon of zone.geometry.coordinates) {
      for (const ring of polygon) {
        ringVertices[ringIndex++] = vertexIndex;
        const ringStart = vertexIndex;
        for (const position of ring) {
          const x = position[0];
          const y = position[1];
          coordinates[vertexIndex * 2] = x;
          coordinates[vertexIndex * 2 + 1] = y;
          if (x < zMinX) zMinX = x;
          if (y < zMinY) zMinY = y;
          if (x > zMaxX) zMaxX = x;
          if (y > zMaxY) zMaxY = y;
          vertexIndex++;
        }
        const edgeCount = Math.max(0, ring.length - 1);
        for (let first = 0; first < edgeCount; first += EDGES_PER_CHUNK) {
          const edges = Math.min(EDGES_PER_CHUNK, edgeCount - first);
          let cMinX = Infinity;
          let cMinY = Infinity;
          let cMaxX = -Infinity;
          let cMaxY = -Infinity;
          for (let v = ringStart + first; v <= ringStart + first + edges; v++) {
            const x = coordinates[v * 2];
            const y = coordinates[v * 2 + 1];
            if (x < cMinX) cMinX = x;
            if (y < cMinY) cMinY = y;
            if (x > cMaxX) cMaxX = x;
            if (y > cMaxY) cMaxY = y;
          }
          chunkFirstVertex[chunkIndex] = ringStart + first;
          chunkEdgeCount[chunkIndex] = edges;
          chunkZone[chunkIndex] = zoneIndex;
          chunkBounds[chunkIndex * 4] = cMinX;
          chunkBounds[chunkIndex * 4 + 1] = cMinY;
          chunkBounds[chunkIndex * 4 + 2] = cMaxX;
          chunkBounds[chunkIndex * 4 + 3] = cMaxY;
          chunksIndex.add(cMinX, cMinY, cMaxX, cMaxY);
          chunkIndex++;
        }
      }
    }
    zoneBounds[zoneIndex * 4] = zMinX;
    zoneBounds[zoneIndex * 4 + 1] = zMinY;
    zoneBounds[zoneIndex * 4 + 2] = zMaxX;
    zoneBounds[zoneIndex * 4 + 3] = zMaxY;
    zonesIndex.add(zMinX, zMinY, zMaxX, zMaxY);
    zoneIndex++;
  }
  zoneRings[zoneIndex] = ringIndex;
  ringVertices[ringIndex] = vertexIndex;
  zonesIndex.finish();
  chunksIndex.finish();

  return {
    ...buffers,
    zonesSpatialIndex: zonesIndex.data,
    chunksSpatialIndex: chunksIndex.data,
  };
}

const orient = (
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);

const isWithin = (
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
) =>
  Math.min(ax, bx) <= cx &&
  cx <= Math.max(ax, bx) &&
  Math.min(ay, by) <= cy &&
  cy <= Math.max(ay, by);

const segmentsIntersect = (
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): boolean => {
  const d1 = orient(cx, cy, dx, dy, ax, ay);
  const d2 = orient(cx, cy, dx, dy, bx, by);
  const d3 = orient(ax, ay, bx, by, cx, cy);
  const d4 = orient(ax, ay, bx, by, dx, dy);
  if (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  )
    return true;
  return (
    (d1 === 0 && isWithin(cx, cy, dx, dy, ax, ay)) ||
    (d2 === 0 && isWithin(cx, cy, dx, dy, bx, by)) ||
    (d3 === 0 && isWithin(ax, ay, bx, by, cx, cy)) ||
    (d4 === 0 && isWithin(ax, ay, bx, by, dx, dy))
  );
};

const isPointInBox = (
  x: number,
  y: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
) => x >= minX && x <= maxX && y >= minY && y <= maxY;

const segmentIntersectsBox = (
  ax: number,
  ay: number,
  bx: number,
  by: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): boolean => {
  if (isPointInBox(ax, ay, minX, minY, maxX, maxY)) return true;
  if (isPointInBox(bx, by, minX, minY, maxX, maxY)) return true;
  if (Math.max(ax, bx) < minX || Math.min(ax, bx) > maxX) return false;
  if (Math.max(ay, by) < minY || Math.min(ay, by) > maxY) return false;
  return (
    segmentsIntersect(ax, ay, bx, by, minX, minY, maxX, minY) ||
    segmentsIntersect(ax, ay, bx, by, maxX, minY, maxX, maxY) ||
    segmentsIntersect(ax, ay, bx, by, maxX, maxY, minX, maxY) ||
    segmentsIntersect(ax, ay, bx, by, minX, maxY, minX, minY)
  );
};

const isPointInRing = (x: number, y: number, ring: Float64Array): boolean => {
  let inside = false;
  const last = ring.length / 2 - 1;
  for (let i = 0; i < last; i++) {
    const ax = ring[i * 2];
    const ay = ring[i * 2 + 1];
    const bx = ring[i * 2 + 2];
    const by = ring[i * 2 + 3];
    if (ay > y !== by > y && x < ax + ((y - ay) * (bx - ax)) / (by - ay))
      inside = !inside;
  }
  return inside;
};

const toClosedRing = (positions: Position[]): Float64Array => {
  const first = positions[0];
  const last = positions[positions.length - 1];
  const isClosed = first[0] === last[0] && first[1] === last[1];
  const length = positions.length + (isClosed ? 0 : 1);
  const ring = new Float64Array(length * 2);
  for (let i = 0; i < length; i++) {
    const position = positions[i % positions.length];
    ring[i * 2] = position[0];
    ring[i * 2 + 1] = position[1];
  }
  return ring;
};

export class ZonesGeoView {
  private readonly zoneCount: number;
  private readonly zoneIds: Uint32Array;
  private readonly zoneBounds: Float64Array;
  private readonly zoneRings: Uint32Array;
  private readonly ringVertices: Uint32Array;
  private readonly coordinates: Float64Array;
  private readonly chunkFirstVertex: Uint32Array;
  private readonly chunkEdgeCount: Uint8Array;
  private readonly chunkZone: Uint32Array;
  private readonly chunkBounds: Float64Array;
  private readonly zonesIndex: Flatbush | null;
  private readonly chunksIndex: Flatbush | null;

  constructor(buffers: ZonesGeoBuffers) {
    this.zoneIds = new Uint32Array(buffers.zoneIds);
    this.zoneCount = this.zoneIds.length;
    this.zoneBounds = new Float64Array(buffers.zoneBounds);
    this.zoneRings = new Uint32Array(buffers.zoneRings);
    this.ringVertices = new Uint32Array(buffers.ringVertices);
    this.coordinates = new Float64Array(buffers.coordinates);
    this.chunkFirstVertex = new Uint32Array(buffers.chunkFirstVertex);
    this.chunkEdgeCount = new Uint8Array(buffers.chunkEdgeCount);
    this.chunkZone = new Uint32Array(buffers.chunkZone);
    this.chunkBounds = new Float64Array(buffers.chunkBounds);
    const isEmpty = this.zoneCount === 0;
    this.zonesIndex = isEmpty ? null : Flatbush.from(buffers.zonesSpatialIndex);
    this.chunksIndex = isEmpty
      ? null
      : Flatbush.from(buffers.chunksSpatialIndex);
  }

  searchContained(searchOptions: SearchOptions): ZoneId[] {
    if (!this.zonesIndex || !this.chunksIndex) return [];
    const search = toSearchPolygon(searchOptions);
    const [minX, minY, maxX, maxY] = search.bounds;

    const candidates: number[] = [];
    this.zonesIndex.search(minX, minY, maxX, maxY, (zone: number) => {
      const b = zone * 4;
      if (
        this.zoneBounds[b] >= minX &&
        this.zoneBounds[b + 1] >= minY &&
        this.zoneBounds[b + 2] <= maxX &&
        this.zoneBounds[b + 3] <= maxY
      )
        candidates.push(zone);
      return false;
    });
    candidates.sort((a, b) => a - b);
    if (search.isBounds || candidates.length === 0)
      return this.toIds(candidates);

    const ring = toClosedRing(search.polygon.geometry.coordinates[0]);
    const pending = new Uint8Array(this.zoneCount);
    let pendingCount = 0;
    for (const zone of candidates) {
      if (this.hasEveryRingStartIn(zone, ring)) {
        pending[zone] = 1;
        pendingCount++;
      }
    }

    const edgeCount = ring.length / 2 - 1;
    for (let i = 0; i < edgeCount && pendingCount > 0; i++) {
      const ax = ring[i * 2];
      const ay = ring[i * 2 + 1];
      const bx = ring[i * 2 + 2];
      const by = ring[i * 2 + 3];
      this.chunksIndex.search(
        Math.min(ax, bx),
        Math.min(ay, by),
        Math.max(ax, bx),
        Math.max(ay, by),
        (chunk: number) => {
          const zone = this.chunkZone[chunk];
          if (!pending[zone]) return false;
          if (this.chunkCrossesSegment(chunk, ax, ay, bx, by)) {
            pending[zone] = 0;
            pendingCount--;
          }
          return false;
        },
      );
    }

    return this.toIds(candidates.filter((zone) => pending[zone]));
  }

  private toIds(zones: number[]): ZoneId[] {
    return zones.map((zone) => this.zoneIds[zone]);
  }

  private hasEveryRingStartIn(zone: number, ring: Float64Array): boolean {
    for (let r = this.zoneRings[zone]; r < this.zoneRings[zone + 1]; r++) {
      const v = this.ringVertices[r];
      if (v === this.ringVertices[r + 1]) continue;
      if (
        !isPointInRing(
          this.coordinates[v * 2],
          this.coordinates[v * 2 + 1],
          ring,
        )
      )
        return false;
    }
    return true;
  }

  private chunkCrossesSegment(
    chunk: number,
    ax: number,
    ay: number,
    bx: number,
    by: number,
  ): boolean {
    const b = chunk * 4;
    if (
      !segmentIntersectsBox(
        ax,
        ay,
        bx,
        by,
        this.chunkBounds[b],
        this.chunkBounds[b + 1],
        this.chunkBounds[b + 2],
        this.chunkBounds[b + 3],
      )
    )
      return false;
    const c = this.coordinates;
    const first = this.chunkFirstVertex[chunk];
    const last = first + this.chunkEdgeCount[chunk];
    for (let v = first; v < last; v++) {
      if (
        segmentsIntersect(
          ax,
          ay,
          bx,
          by,
          c[v * 2],
          c[v * 2 + 1],
          c[v * 2 + 2],
          c[v * 2 + 3],
        )
      )
        return true;
    }
    return false;
  }
}

export function queryContainedZones(
  geo: ZonesGeoView,
  searchOptions: SearchOptions,
): ZoneId[] {
  return geo.searchContained(searchOptions);
}
