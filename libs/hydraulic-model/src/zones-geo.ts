import Flatbush from "flatbush";
import type { Position } from "geojson";
import type { ZoneId, Zones } from "./zones";
import type { SearchOptions } from "./spatial-queries";
import type { AssetId } from "./asset-types";
import type { AssetsGeoQueries } from "./assets-geo";
import type { CustomerPointsGeoQueries } from "./customer-points-geo";
import { toSearchPolygon } from "./spatial-queries";
import { BinaryData, BufferType, createBuffer } from "@epanet-js/buffers";

const EDGES_PER_CHUNK = 16;

export type ZonesGeoBuffers = {
  zoneIds: BinaryData;
  zoneBounds: BinaryData;
  zoneRings: BinaryData;
  zoneChunks: BinaryData;
  ringVertices: BinaryData;
  coordinates: BinaryData;
  zonesSpatialIndex: BinaryData;
  chunkFirstVertex: BinaryData;
  chunkEdgeCount: BinaryData;
  chunkZone: BinaryData;
  chunkPolygon: BinaryData;
  chunkBounds: BinaryData;
  chunksSpatialIndex: BinaryData;
};

const bufferKeys: (keyof ZonesGeoBuffers)[] = [
  "zoneIds",
  "zoneBounds",
  "zoneRings",
  "zoneChunks",
  "ringVertices",
  "coordinates",
  "zonesSpatialIndex",
  "chunkFirstVertex",
  "chunkEdgeCount",
  "chunkZone",
  "chunkPolygon",
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
    zoneChunks: u32(zoneCount + 1),
    ringVertices: u32(ringCount + 1),
    coordinates: f64(vertexCount * 2),
    chunkFirstVertex: u32(chunkCount),
    chunkEdgeCount: createBuffer(chunkCount, bufferType),
    chunkZone: u32(chunkCount),
    chunkPolygon: u32(chunkCount),
    chunkBounds: f64(chunkCount * 4),
  };
  const zoneIds = new Uint32Array(buffers.zoneIds);
  const zoneBounds = new Float64Array(buffers.zoneBounds);
  const zoneRings = new Uint32Array(buffers.zoneRings);
  const zoneChunks = new Uint32Array(buffers.zoneChunks);
  const ringVertices = new Uint32Array(buffers.ringVertices);
  const coordinates = new Float64Array(buffers.coordinates);
  const chunkFirstVertex = new Uint32Array(buffers.chunkFirstVertex);
  const chunkEdgeCount = new Uint8Array(buffers.chunkEdgeCount);
  const chunkZone = new Uint32Array(buffers.chunkZone);
  const chunkPolygon = new Uint32Array(buffers.chunkPolygon);
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
  let polygonIndex = 0;
  let ringIndex = 0;
  let vertexIndex = 0;
  let chunkIndex = 0;
  for (const zone of zones.values()) {
    zoneIds[zoneIndex] = zone.id;
    zoneRings[zoneIndex] = ringIndex;
    zoneChunks[zoneIndex] = chunkIndex;
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
          chunkPolygon[chunkIndex] = polygonIndex;
          chunkBounds[chunkIndex * 4] = cMinX;
          chunkBounds[chunkIndex * 4 + 1] = cMinY;
          chunkBounds[chunkIndex * 4 + 2] = cMaxX;
          chunkBounds[chunkIndex * 4 + 3] = cMaxY;
          chunksIndex.add(cMinX, cMinY, cMaxX, cMaxY);
          chunkIndex++;
        }
      }
      polygonIndex++;
    }
    zoneBounds[zoneIndex * 4] = zMinX;
    zoneBounds[zoneIndex * 4 + 1] = zMinY;
    zoneBounds[zoneIndex * 4 + 2] = zMaxX;
    zoneBounds[zoneIndex * 4 + 3] = zMaxY;
    zonesIndex.add(zMinX, zMinY, zMaxX, zMaxY);
    zoneIndex++;
  }
  zoneRings[zoneIndex] = ringIndex;
  zoneChunks[zoneIndex] = chunkIndex;
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

const GRID_SIZE = 64;
const BOUNDARY_CELL = 1;

type ZoneLookup = {
  firstChunk: number;
  index: Flatbush;
  cells: Uint8Array;
  cellPolygons: Map<number, number[]>;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  cellWidth: number;
  cellHeight: number;
};

const cellColumn = (lookup: ZoneLookup, x: number) =>
  Math.min(
    GRID_SIZE - 1,
    Math.max(0, Math.floor((x - lookup.minX) / lookup.cellWidth)),
  );

const cellRow = (lookup: ZoneLookup, y: number) =>
  Math.min(
    GRID_SIZE - 1,
    Math.max(0, Math.floor((y - lookup.minY) / lookup.cellHeight)),
  );

const segmentsStrictlyCross = (
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): boolean =>
  orient(cx, cy, dx, dy, ax, ay) * orient(cx, cy, dx, dy, bx, by) < 0 &&
  orient(ax, ay, bx, by, cx, cy) * orient(ax, ay, bx, by, dx, dy) < 0;

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
  private readonly zoneChunks: Uint32Array;
  private readonly ringVertices: Uint32Array;
  private readonly coordinates: Float64Array;
  private readonly chunkFirstVertex: Uint32Array;
  private readonly chunkEdgeCount: Uint8Array;
  private readonly chunkZone: Uint32Array;
  private readonly chunkPolygon: Uint32Array;
  private readonly chunkBounds: Float64Array;
  private readonly zonesIndex: Flatbush | null;
  private readonly chunksIndex: Flatbush | null;

  constructor(buffers: ZonesGeoBuffers) {
    this.zoneIds = new Uint32Array(buffers.zoneIds);
    this.zoneCount = this.zoneIds.length;
    this.zoneBounds = new Float64Array(buffers.zoneBounds);
    this.zoneRings = new Uint32Array(buffers.zoneRings);
    this.zoneChunks = new Uint32Array(buffers.zoneChunks);
    this.ringVertices = new Uint32Array(buffers.ringVertices);
    this.coordinates = new Float64Array(buffers.coordinates);
    this.chunkFirstVertex = new Uint32Array(buffers.chunkFirstVertex);
    this.chunkEdgeCount = new Uint8Array(buffers.chunkEdgeCount);
    this.chunkZone = new Uint32Array(buffers.chunkZone);
    this.chunkPolygon = new Uint32Array(buffers.chunkPolygon);
    this.chunkBounds = new Float64Array(buffers.chunkBounds);
    const isEmpty = this.zoneCount === 0;
    this.zonesIndex = isEmpty ? null : Flatbush.from(buffers.zonesSpatialIndex);
    this.chunksIndex = isEmpty
      ? null
      : Flatbush.from(buffers.chunksSpatialIndex);
  }

  searchIntersecting(searchOptions: SearchOptions): ZoneId[] {
    if (!this.zonesIndex || !this.chunksIndex) return [];
    const search = toSearchPolygon(searchOptions);
    const [minX, minY, maxX, maxY] = search.bounds;
    const ring = search.isBounds
      ? null
      : toClosedRing(search.polygon.geometry.coordinates[0]);
    const isBox = ring === null;

    const matched = new Uint8Array(this.zoneCount);
    const pending = new Uint8Array(this.zoneCount);
    let pendingCount = 0;
    this.zonesIndex.search(minX, minY, maxX, maxY, (zone: number) => {
      const b = zone * 4;
      if (
        isBox &&
        this.zoneBounds[b] >= minX &&
        this.zoneBounds[b + 1] >= minY &&
        this.zoneBounds[b + 2] <= maxX &&
        this.zoneBounds[b + 3] <= maxY
      ) {
        matched[zone] = 1;
      } else {
        pending[zone] = 1;
        pendingCount++;
      }
      return false;
    });

    const resolve = (zone: number) => {
      pending[zone] = 0;
      matched[zone] = 1;
      pendingCount--;
    };

    if (pendingCount > 0) {
      for (let zone = 0; zone < this.zoneCount; zone++) {
        if (!pending[zone]) continue;
        const v = this.ringVertices[this.zoneRings[zone]];
        const x = this.coordinates[v * 2];
        const y = this.coordinates[v * 2 + 1];
        const isInside = ring
          ? isPointInRing(x, y, ring)
          : isPointInBox(x, y, minX, minY, maxX, maxY);
        if (isInside) resolve(zone);
      }
    }

    if (pendingCount > 0) {
      if (!ring) {
        this.chunksIndex.search(minX, minY, maxX, maxY, (chunk: number) => {
          const zone = this.chunkZone[chunk];
          if (!pending[zone]) return false;
          if (this.chunkCrossesBox(chunk, minX, minY, maxX, maxY))
            resolve(zone);
          return false;
        });
      } else {
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
              if (this.chunkCrossesSegment(chunk, ax, ay, bx, by))
                resolve(zone);
              return false;
            },
          );
        }
      }
    }

    if (pendingCount > 0) {
      const px = ring ? ring[0] : minX;
      const py = ring ? ring[1] : minY;
      const parity = new Uint8Array(this.zoneCount);
      this.chunksIndex.search(px, py, Infinity, py, (chunk: number) => {
        const zone = this.chunkZone[chunk];
        if (pending[zone])
          parity[zone] ^= this.chunkRayCrossings(chunk, px, py);
        return false;
      });
      for (let zone = 0; zone < this.zoneCount; zone++) {
        if (pending[zone] && parity[zone]) resolve(zone);
      }
    }

    const ids: ZoneId[] = [];
    for (let zone = 0; zone < this.zoneCount; zone++) {
      if (matched[zone]) ids.push(this.zoneIds[zone]);
    }
    return ids;
  }

  private chunkCrossesBox(
    chunk: number,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ): boolean {
    const c = this.coordinates;
    const first = this.chunkFirstVertex[chunk];
    const last = first + this.chunkEdgeCount[chunk];
    for (let v = first; v < last; v++) {
      if (
        segmentIntersectsBox(
          c[v * 2],
          c[v * 2 + 1],
          c[v * 2 + 2],
          c[v * 2 + 3],
          minX,
          minY,
          maxX,
          maxY,
        )
      )
        return true;
    }
    return false;
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

  private chunkRayCrossings(chunk: number, px: number, py: number): number {
    const c = this.coordinates;
    const first = this.chunkFirstVertex[chunk];
    const last = first + this.chunkEdgeCount[chunk];
    let crossings = 0;
    for (let v = first; v < last; v++) {
      const ax = c[v * 2];
      const ay = c[v * 2 + 1];
      const bx = c[v * 2 + 2];
      const by = c[v * 2 + 3];
      if (ay > py !== by > py && px < ax + ((py - ay) * (bx - ax)) / (by - ay))
        crossings ^= 1;
    }
    return crossings;
  }

  private zoneIndexById?: Map<ZoneId, number>;

  zoneIndexOf(zoneId: ZoneId): number | undefined {
    if (!this.zoneIndexById) {
      this.zoneIndexById = new Map();
      for (let zone = 0; zone < this.zoneCount; zone++)
        this.zoneIndexById.set(this.zoneIds[zone], zone);
    }
    return this.zoneIndexById.get(zoneId);
  }

  zoneBoundsOf(zone: number): [number, number, number, number] {
    const b = zone * 4;
    return [
      this.zoneBounds[b],
      this.zoneBounds[b + 1],
      this.zoneBounds[b + 2],
      this.zoneBounds[b + 3],
    ];
  }

  private lookups = new Map<number, ZoneLookup>();

  private lookupOf(zone: number): ZoneLookup {
    let lookup = this.lookups.get(zone);
    if (lookup) return lookup;
    const firstChunk = this.zoneChunks[zone];
    const lastChunk = this.zoneChunks[zone + 1];
    const [minX, minY, maxX, maxY] = this.zoneBoundsOf(zone);
    const cellWidth = (maxX - minX) / GRID_SIZE || 1;
    const cellHeight = (maxY - minY) / GRID_SIZE || 1;
    const index = new Flatbush(Math.max(1, lastChunk - firstChunk));
    const cells = new Uint8Array(GRID_SIZE * GRID_SIZE);
    lookup = {
      firstChunk,
      index,
      cells,
      cellPolygons: new Map(),
      minX,
      minY,
      maxX,
      maxY,
      cellWidth,
      cellHeight,
    };
    if (lastChunk === firstChunk) index.add(0, 0, 0, 0);
    const c = this.coordinates;
    for (let chunk = firstChunk; chunk < lastChunk; chunk++) {
      const b = chunk * 4;
      index.add(
        this.chunkBounds[b],
        this.chunkBounds[b + 1],
        this.chunkBounds[b + 2],
        this.chunkBounds[b + 3],
      );
      const first = this.chunkFirstVertex[chunk];
      const last = first + this.chunkEdgeCount[chunk];
      for (let v = first; v < last; v++) {
        const col0 = cellColumn(lookup, Math.min(c[v * 2], c[v * 2 + 2]));
        const col1 = cellColumn(lookup, Math.max(c[v * 2], c[v * 2 + 2]));
        const row0 = cellRow(lookup, Math.min(c[v * 2 + 1], c[v * 2 + 3]));
        const row1 = cellRow(lookup, Math.max(c[v * 2 + 1], c[v * 2 + 3]));
        for (let row = row0; row <= row1; row++)
          for (let col = col0; col <= col1; col++)
            cells[row * GRID_SIZE + col] = BOUNDARY_CELL;
      }
    }
    index.finish();
    this.lookups.set(zone, lookup);
    return lookup;
  }

  polygonsAt(zone: number, x: number, y: number): number[] {
    if (!this.chunksIndex) return [];
    const lookup = this.lookupOf(zone);
    if (
      x < lookup.minX ||
      x > lookup.maxX ||
      y < lookup.minY ||
      y > lookup.maxY
    )
      return [];
    const cell = cellRow(lookup, y) * GRID_SIZE + cellColumn(lookup, x);
    if (lookup.cells[cell] === BOUNDARY_CELL)
      return this.rayCastPolygons(zone, lookup, x, y);
    let polygons = lookup.cellPolygons.get(cell);
    if (!polygons) {
      const col = cell % GRID_SIZE;
      const row = (cell - col) / GRID_SIZE;
      polygons = this.rayCastPolygons(
        zone,
        lookup,
        lookup.minX + (col + 0.5) * lookup.cellWidth,
        lookup.minY + (row + 0.5) * lookup.cellHeight,
      );
      lookup.cellPolygons.set(cell, polygons);
    }
    return polygons;
  }

  private rayCastPolygons(
    zone: number,
    lookup: ZoneLookup,
    x: number,
    y: number,
  ): number[] {
    const parity = new Map<number, boolean>();
    const onBoundary = new Set<number>();
    const c = this.coordinates;
    lookup.index.search(x, y, Infinity, y, (item: number) => {
      const chunk = lookup.firstChunk + item;
      if (this.chunkZone[chunk] !== zone) return false;
      const polygon = this.chunkPolygon[chunk];
      const first = this.chunkFirstVertex[chunk];
      const last = first + this.chunkEdgeCount[chunk];
      for (let v = first; v < last; v++) {
        const ax = c[v * 2];
        const ay = c[v * 2 + 1];
        const bx = c[v * 2 + 2];
        const by = c[v * 2 + 3];
        if (
          orient(ax, ay, bx, by, x, y) === 0 &&
          isWithin(ax, ay, bx, by, x, y)
        ) {
          onBoundary.add(polygon);
        } else if (
          ay > y !== by > y &&
          x < ax + ((y - ay) * (bx - ax)) / (by - ay)
        ) {
          parity.set(polygon, !parity.get(polygon));
        }
      }
      return false;
    });
    const polygons = [...onBoundary];
    for (const [polygon, isInside] of parity) {
      if (isInside && !onBoundary.has(polygon)) polygons.push(polygon);
    }
    return polygons;
  }

  private mayCrossBoundary(
    lookup: ZoneLookup,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ): boolean {
    if (
      maxX < lookup.minX ||
      minX > lookup.maxX ||
      maxY < lookup.minY ||
      minY > lookup.maxY
    )
      return false;
    const col0 = cellColumn(lookup, minX);
    const col1 = cellColumn(lookup, maxX);
    const row0 = cellRow(lookup, minY);
    const row1 = cellRow(lookup, maxY);
    for (let row = row0; row <= row1; row++)
      for (let col = col0; col <= col1; col++)
        if (lookup.cells[row * GRID_SIZE + col] === BOUNDARY_CELL) return true;
    const isWithinBounds =
      minX >= lookup.minX &&
      maxX <= lookup.maxX &&
      minY >= lookup.minY &&
      maxY <= lookup.maxY;
    return !isWithinBounds;
  }

  containsPoint(zone: number, x: number, y: number): boolean {
    return this.polygonsAt(zone, x, y).length > 0;
  }

  zonesAt(x: number, y: number): ZoneId[] {
    if (!this.zonesIndex) return [];
    const ids: ZoneId[] = [];
    for (const zone of this.zonesIndex.search(x, y, x, y)) {
      if (this.containsPoint(zone, x, y)) ids.push(this.zoneIds[zone]);
    }
    return ids;
  }

  classifyLine(zone: number, line: Position[]): "inside" | "boundary" | null {
    if (!this.chunksIndex) return null;
    let candidates: Set<number> | null = null;
    let isStartInside = false;
    let isEndInside = false;
    for (let i = 0; i < line.length; i++) {
      const polygons = this.polygonsAt(zone, line[i][0], line[i][1]);
      if (i === 0) isStartInside = polygons.length > 0;
      if (i === line.length - 1) isEndInside = polygons.length > 0;
      candidates = candidates
        ? new Set(polygons.filter((polygon) => candidates!.has(polygon)))
        : new Set(polygons);
    }
    const contained = candidates ?? new Set<number>();
    const lookup = this.lookupOf(zone);
    const c = this.coordinates;
    for (let i = 1; i < line.length && contained.size > 0; i++) {
      const ax = line[i - 1][0];
      const ay = line[i - 1][1];
      const bx = line[i][0];
      const by = line[i][1];
      const minX = Math.min(ax, bx);
      const minY = Math.min(ay, by);
      const maxX = Math.max(ax, bx);
      const maxY = Math.max(ay, by);
      if (!this.mayCrossBoundary(lookup, minX, minY, maxX, maxY)) continue;
      lookup.index.search(minX, minY, maxX, maxY, (item: number) => {
        const chunk = lookup.firstChunk + item;
        if (this.chunkZone[chunk] !== zone) return false;
        const polygon = this.chunkPolygon[chunk];
        const first = this.chunkFirstVertex[chunk];
        const last = first + this.chunkEdgeCount[chunk];
        for (let v = first; v < last; v++) {
          if (
            segmentsStrictlyCross(
              ax,
              ay,
              bx,
              by,
              c[v * 2],
              c[v * 2 + 1],
              c[v * 2 + 2],
              c[v * 2 + 3],
            )
          ) {
            contained.delete(polygon);
            break;
          }
        }
        return false;
      });
    }
    if (contained.size > 0) return "inside";
    if (isStartInside !== isEndInside) return "boundary";
    return null;
  }
}

export function queryIntersectingZones(
  geo: ZonesGeoView,
  searchOptions: SearchOptions,
): ZoneId[] {
  return geo.searchIntersecting(searchOptions);
}

export type ZoneContents = {
  assetIds: AssetId[];
  boundaryAssetIds: AssetId[];
  customerPointIds: number[];
};

export function queryZoneContents(
  zonesGeo: ZonesGeoView,
  assetsGeo: AssetsGeoQueries,
  customerPointsGeo: CustomerPointsGeoQueries | null,
  zoneIds: ZoneId[],
): ZoneContents {
  const assetIds = new Set<AssetId>();
  const boundaryAssetIds = new Set<AssetId>();
  const customerPointIds = new Set<number>();

  for (const zoneId of zoneIds) {
    const zone = zonesGeo.zoneIndexOf(zoneId);
    if (zone === undefined) continue;
    const bounds = zonesGeo.zoneBoundsOf(zone);

    assetsGeo.searchNodes(bounds, (nodeId) => {
      const position = assetsGeo.getNodePosition(nodeId);
      if (position && zonesGeo.containsPoint(zone, position[0], position[1]))
        assetIds.add(nodeId);
      return false;
    });

    const linkIds = new Set<AssetId>();
    assetsGeo.searchLinkSegments(bounds, (segmentId) => {
      linkIds.add(assetsGeo.getSegmentLinkId(segmentId));
      return false;
    });
    for (const linkId of linkIds) {
      if (assetIds.has(linkId)) continue;
      const segments = assetsGeo.getLinkSegments(linkId);
      if (segments.length === 0) continue;
      const line: Position[] = [assetsGeo.getSegmentCoords(segments[0])[0]];
      for (const segmentId of segments)
        line.push(assetsGeo.getSegmentCoords(segmentId)[1]);
      const placement = zonesGeo.classifyLine(zone, line);
      if (placement === "inside") {
        assetIds.add(linkId);
        boundaryAssetIds.delete(linkId);
      } else if (placement === "boundary") {
        boundaryAssetIds.add(linkId);
      }
    }

    customerPointsGeo?.searchCustomerPoints(bounds, (id, position) => {
      if (zonesGeo.containsPoint(zone, position[0], position[1]))
        customerPointIds.add(id);
      return false;
    });
  }

  return {
    assetIds: [...assetIds],
    boundaryAssetIds: [...boundaryAssetIds],
    customerPointIds: [...customerPointIds],
  };
}
