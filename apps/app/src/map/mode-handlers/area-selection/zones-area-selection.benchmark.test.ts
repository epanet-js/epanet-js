/* eslint-disable no-console */
import type { Position } from "geojson";
import {
  encodeZonesGeo,
  queryIntersectingZones,
  ZonesGeoView,
  type Zones,
  type ZonesGeoBuffers,
} from "@epanet-js/hydraulic-model";
import { buildZone } from "@epanet-js/hydraulic-model-testing";

const ZONE_COUNT = 1000;
const VERTICES_PER_ZONE = 1000;
const COLUMNS = 40;
const CELL = 0.01;
const RUNS = 50;

const wavyRing = (cx: number, cy: number, seed: number): Position[] => {
  const ring: Position[] = [];
  for (let i = 0; i < VERTICES_PER_ZONE; i++) {
    const angle = (i / VERTICES_PER_ZONE) * 2 * Math.PI;
    const radius =
      CELL * 0.45 * (1 + 0.08 * Math.sin(angle * (7 + (seed % 5))));
    ring.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
  }
  ring.push(ring[0]);
  return ring;
};

const buildZones = (): Zones => {
  const zones: Zones = new Map();
  for (let i = 0; i < ZONE_COUNT; i++) {
    const cx = (i % COLUMNS) * CELL;
    const cy = Math.floor(i / COLUMNS) * CELL;
    const zone = buildZone({
      id: i + 1,
      label: `Z${i + 1}`,
      geometry: { type: "MultiPolygon", coordinates: [[wavyRing(cx, cy, i)]] },
      bbox: [0, 0, 0, 0],
    });
    zones.set(zone.id, zone);
  }
  return zones;
};

const box = (
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): Position[] => [
  [minX, minY],
  [maxX, minY],
  [maxX, maxY],
  [minX, maxY],
  [minX, minY],
];

const freehandLasso = (cx: number, cy: number, r: number): Position[] => {
  const ring: Position[] = [];
  for (let i = 0; i < 200; i++) {
    const angle = (i / 200) * 2 * Math.PI;
    const radius = r * (1 + 0.2 * Math.sin(angle * 3));
    ring.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
  }
  ring.push(ring[0]);
  return ring;
};

const rows = ZONE_COUNT / COLUMNS;
const width = COLUMNS * CELL;
const height = rows * CELL;

const areas: { name: string; points: Position[] }[] = [
  { name: "small box, one zone", points: box(0.1, 0.1, 0.102, 0.102) },
  { name: "box between zones", points: box(0.0047, 0.0047, 0.0053, 0.0053) },
  { name: "medium box, ~50 zones", points: box(0.05, 0.05, 0.12, 0.12) },
  {
    name: "box over everything",
    points: box(-CELL, -CELL, width, height),
  },
  {
    name: "freehand lasso, 200 points",
    points: freehandLasso(width / 2, height / 2, 0.06),
  },
  {
    name: "polygon lasso, long diagonals",
    points: [
      [-CELL, -CELL],
      [width, height * 0.4],
      [width * 0.6, height],
      [-CELL, height * 0.7],
      [-CELL, -CELL],
    ],
  },
];

const isPointInRings = (x: number, y: number, rings: Position[][]) => {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const [ax, ay] = ring[i];
      const [bx, by] = ring[i + 1];
      if (ay > y !== by > y && x < ax + ((y - ay) * (bx - ax)) / (by - ay))
        inside = !inside;
    }
  }
  return inside;
};

const orient = (a: Position, b: Position, c: Position) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

const isWithin = (a: Position, b: Position, p: Position) =>
  Math.min(a[0], b[0]) <= p[0] &&
  p[0] <= Math.max(a[0], b[0]) &&
  Math.min(a[1], b[1]) <= p[1] &&
  p[1] <= Math.max(a[1], b[1]);

const crosses = (a: Position, b: Position, c: Position, d: Position) => {
  const d1 = orient(c, d, a);
  const d2 = orient(c, d, b);
  const d3 = orient(a, b, c);
  const d4 = orient(a, b, d);
  if (d1 * d2 < 0 && d3 * d4 < 0) return true;
  return (
    (d1 === 0 && isWithin(c, d, a)) ||
    (d2 === 0 && isWithin(c, d, b)) ||
    (d3 === 0 && isWithin(a, b, c)) ||
    (d4 === 0 && isWithin(a, b, d))
  );
};

const bruteForce = (zones: Zones, area: Position[]): number[] => {
  const ids: number[] = [];
  for (const zone of zones.values()) {
    const rings = zone.geometry.coordinates.flat();
    const hit =
      isPointInRings(area[0][0], area[0][1], rings) ||
      isPointInRings(rings[0][0][0], rings[0][0][1], [area]) ||
      rings.some((ring) => {
        for (let i = 0; i < ring.length - 1; i++) {
          for (let j = 0; j < area.length - 1; j++) {
            if (crosses(ring[i], ring[i + 1], area[j], area[j + 1]))
              return true;
          }
        }
        return false;
      });
    if (hit) ids.push(zone.id);
  }
  return ids;
};

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

const totalBytes = (buffers: ZonesGeoBuffers) =>
  Object.values(buffers).reduce((sum, b) => sum + b.byteLength, 0);

describe("zones area selection benchmark", () => {
  it(`queries ${ZONE_COUNT} zones of ${VERTICES_PER_ZONE} vertices`, () => {
    const zones = buildZones();

    const encodeStart = performance.now();
    const buffers = encodeZonesGeo(zones);
    const encodeMs = performance.now() - encodeStart;
    const view = new ZonesGeoView(buffers);

    console.log(
      `encode: ${encodeMs.toFixed(1)} ms, buffers: ${(
        totalBytes(buffers) /
        1024 /
        1024
      ).toFixed(1)} MB`,
    );

    for (const { name, points } of areas) {
      const timings: number[] = [];
      let ids: number[] = [];
      for (let run = 0; run < RUNS; run++) {
        const start = performance.now();
        ids = queryIntersectingZones(view, points);
        timings.push(performance.now() - start);
      }

      const bruteStart = performance.now();
      const expected = bruteForce(zones, points);
      const bruteMs = performance.now() - bruteStart;

      console.log(
        `${name}: ${ids.length} zones, median ${median(timings).toFixed(
          2,
        )} ms, max ${Math.max(...timings).toFixed(2)} ms (brute force ${bruteMs.toFixed(0)} ms)`,
      );
      expect(ids).toEqual(expected);
    }
  });
});
