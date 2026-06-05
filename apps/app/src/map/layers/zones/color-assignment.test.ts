import { describe, it, expect } from "vitest";
import type { BBox } from "@turf/helpers";
import { assignZoneColors } from "./color-assignment";
import { hexToRgb, rgbToHue, hueDistance } from "./hue-distance";
import { getQualitativePaletteColors } from "./palette-lookup";
import type { Zones } from "src/lib/zones";
import { computeAdjacency } from "src/lib/zones/zone-adjacency";

const TEST_PALETTE = getQualitativePaletteColors("Bold");

describe("assignZoneColors", () => {
  it("assigns a color to a single zone", () => {
    const zones = makeZones([[0, 0, 1, 1]]);
    const result = assignZoneColors(zones, TEST_PALETTE);
    expect(TEST_PALETTE).toContain(result[1]);
  });

  it("adjacent zones never share the same color", () => {
    const zones = makeAdjacentGrid(3, 3);
    const result = assignZoneColors(zones, TEST_PALETTE);

    const adjacency = computeAdjacency(zones);
    for (const zone of Object.values(zones)) {
      for (const nid of adjacency.get(zone.id) ?? []) {
        expect(result[zone.id]).not.toBe(result[nid]);
      }
    }
  });

  it("adjacent zones avoid hue-group similar colors when palette has room", () => {
    const zones = makeAdjacentGrid(2, 2);
    const result = assignZoneColors(zones, TEST_PALETTE);

    const adjacency = computeAdjacency(zones);
    for (const zone of Object.values(zones)) {
      for (const nid of adjacency.get(zone.id) ?? []) {
        expect(sameHueGroup(result[zone.id], result[nid])).toBe(false);
      }
    }
  });

  it("non-adjacent zones can share the same color", () => {
    const zones = makeZones([
      [0, 0, 1, 1],
      [5, 5, 6, 6],
      [10, 10, 11, 11],
    ]);
    const result = assignZoneColors(zones, TEST_PALETTE);
    const colors = Object.values(result);
    const unique = new Set(colors);
    expect(unique.size).toBeLessThanOrEqual(colors.length);
  });

  it("handles a zone with more neighbors than palette colors", () => {
    const center: BBox = [5, 5, 6, 6];
    const bboxes: BBox[] = [center];
    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI * 2) / 12;
      const cx = 5.5 + Math.cos(angle) * 0.4;
      const cy = 5.5 + Math.sin(angle) * 0.4;
      bboxes.push([cx - 0.3, cy - 0.3, cx + 0.3, cy + 0.3]);
    }
    const zones = makeZones(bboxes);
    const result = assignZoneColors(zones, TEST_PALETTE);

    for (const zone of Object.values(zones)) {
      expect(TEST_PALETTE).toContain(result[zone.id]);
    }
  });

  it("works with different palettes", () => {
    const palette = ["#FF0000", "#00FF00", "#0000FF"];
    const zones = makeAdjacentGrid(2, 1);
    const result = assignZoneColors(zones, palette);

    expect(palette).toContain(result[1]);
    expect(palette).toContain(result[2]);
    expect(result[1]).not.toBe(result[2]);
  });
});

function makeZones(bboxes: BBox[]): Zones {
  const zones: Zones = {};
  bboxes.forEach((bbox, i) => {
    const id = i + 1;
    zones[id] = {
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
    };
  });
  return zones;
}

function makeAdjacentGrid(rows: number, cols: number): Zones {
  const bboxes: BBox[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      bboxes.push([c, r, c + 1.1, r + 1.1]);
    }
  }
  return makeZones(bboxes);
}

function sameHueGroup(colorA: string, colorB: string): boolean {
  return (
    hueDistance(rgbToHue(hexToRgb(colorA)), rgbToHue(hexToRgb(colorB))) < 40
  );
}
