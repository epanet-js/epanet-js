import { describe, it, expect } from "vitest";
import type { BBox } from "@turf/helpers";
import { bboxOverlaps, computeAdjacency } from "./zone-adjacency";
import type { Zones } from "./zones";

describe("bboxOverlaps", () => {
  it("returns true for overlapping bboxes", () => {
    const a: BBox = [0, 0, 2, 2];
    const b: BBox = [1, 1, 3, 3];
    expect(bboxOverlaps(a, b)).toBe(true);
  });

  it("returns false for disjoint bboxes", () => {
    const a: BBox = [0, 0, 1, 1];
    const b: BBox = [2, 2, 3, 3];
    expect(bboxOverlaps(a, b)).toBe(false);
  });

  it("returns false for bboxes that only share an edge", () => {
    const a: BBox = [0, 0, 1, 1];
    const b: BBox = [1, 0, 2, 1];
    expect(bboxOverlaps(a, b)).toBe(false);
  });

  it("returns false for bboxes that only share a corner", () => {
    const a: BBox = [0, 0, 1, 1];
    const b: BBox = [1, 1, 2, 2];
    expect(bboxOverlaps(a, b)).toBe(false);
  });

  it("returns true when one bbox contains another", () => {
    const a: BBox = [0, 0, 10, 10];
    const b: BBox = [2, 2, 5, 5];
    expect(bboxOverlaps(a, b)).toBe(true);
  });
});

describe("computeAdjacency", () => {
  it("returns empty adjacency for a single zone", () => {
    const zones = makeZones([[0, 0, 1, 1]]);
    const adj = computeAdjacency(zones);
    expect(adj.get(1)).toEqual([]);
  });

  it("detects overlapping zones as adjacent", () => {
    const zones = makeZones([
      [0, 0, 2, 2],
      [1, 1, 3, 3],
    ]);
    const adj = computeAdjacency(zones);
    expect(adj.get(1)).toContain(2);
    expect(adj.get(2)).toContain(1);
  });

  it("does not mark disjoint zones as adjacent", () => {
    const zones = makeZones([
      [0, 0, 1, 1],
      [5, 5, 6, 6],
    ]);
    const adj = computeAdjacency(zones);
    expect(adj.get(1)).toEqual([]);
    expect(adj.get(2)).toEqual([]);
  });

  it("adjacency is symmetric", () => {
    const zones = makeZones([
      [0, 0, 2, 2],
      [1, 1, 3, 3],
      [2.5, 0, 4, 2],
    ]);
    const adj = computeAdjacency(zones);

    for (const [id, neighbors] of adj) {
      for (const nid of neighbors) {
        expect(adj.get(nid)).toContain(id);
      }
    }
  });

  it("handles empty zones record", () => {
    const adj = computeAdjacency(new Map());
    expect(adj.size).toBe(0);
  });
});

function makeZones(bboxes: BBox[]): Zones {
  const zones: Zones = new Map();
  bboxes.forEach((bbox, i) => {
    const id = i + 1;
    zones.set(id, {
      id,
      label: `Z${id}`,
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [bbox[0], bbox[1]],
              [bbox[2], bbox[1]],
              [bbox[2], bbox[3]],
              [bbox[0], bbox[3]],
              [bbox[0], bbox[1]],
            ],
          ],
        ],
      },
      bbox,
    });
  });
  return zones;
}
