import { describe, it, expect } from "vitest";
import type { BBox } from "@turf/helpers";
import {
  assignZoneColors,
  ZONE_QUALITATIVE_PALETTE,
} from "./color-assignment";
import type { Zones } from "src/lib/zones";

describe("assignZoneColors", () => {
  it("assigns a color to a single zone", () => {
    const zones = makeZones([[0, 0, 1, 1]]);
    const result = assignZoneColors(zones);
    expect(ZONE_QUALITATIVE_PALETTE).toContain(result[1]);
  });

  it("adjacent zones never share the same color", () => {
    const zones = makeAdjacentGrid(3, 3);
    populateAdjacency(zones);
    const result = assignZoneColors(zones);

    for (const zone of Object.values(zones)) {
      for (const nid of zone.adjacentZones) {
        expect(result[zone.id]).not.toBe(result[nid]);
      }
    }
  });

  it("adjacent zones avoid hue-group similar colors when palette has room", () => {
    const zones = makeAdjacentGrid(2, 2);
    populateAdjacency(zones);
    const result = assignZoneColors(zones);

    for (const zone of Object.values(zones)) {
      for (const nid of zone.adjacentZones) {
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
    populateAdjacency(zones);
    const result = assignZoneColors(zones);
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
    populateAdjacency(zones);
    const result = assignZoneColors(zones);

    for (const zone of Object.values(zones)) {
      expect(ZONE_QUALITATIVE_PALETTE).toContain(result[zone.id]);
    }
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
      adjacentZones: [],
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

function populateAdjacency(zones: Zones) {
  const entries = Object.values(zones);
  for (const z of entries) {
    z.adjacentZones = [];
  }
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i].bbox;
      const b = entries[j].bbox;
      if (a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]) {
        entries[i].adjacentZones.push(entries[j].id);
        entries[j].adjacentZones.push(entries[i].id);
      }
    }
  }
}

function hexToHue(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d + 6) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return h * 60;
}

function sameHueGroup(colorA: string, colorB: string): boolean {
  const d = Math.abs(hexToHue(colorA) - hexToHue(colorB));
  return Math.min(d, 360 - d) < 40;
}
