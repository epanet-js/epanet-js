import type { Zones, ZoneId } from "src/lib/zones";

export const ZONE_QUALITATIVE_PALETTE = [
  "#7F3C8D",
  "#11A579",
  "#3969AC",
  "#F2B701",
  "#E73F74",
  "#80BA5A",
  "#E68310",
  "#008695",
  "#CF1C90",
  "#f97b72",
  "#4b4b8f",
];

type RGB = [number, number, number];

const HUE_DISTANCE_THRESHOLD = 40;

const hexToRgb = (hex: string): RGB => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const rgbToHue = ([r, g, b]: RGB): number => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === rn) h = ((gn - bn) / d + 6) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return h * 60;
};

const hueDistance = (a: number, b: number): number => {
  const d = Math.abs(a - b);
  return Math.min(d, 360 - d);
};

const buildHueGroupMap = (palette: string[]): Map<number, Set<number>> => {
  const hues = palette.map((hex) => rgbToHue(hexToRgb(hex)));
  const parent = palette.map((_, i) => i);
  const find = (i: number): number =>
    parent[i] === i ? i : (parent[i] = find(parent[i]));
  const union = (a: number, b: number) => {
    parent[find(a)] = find(b);
  };

  for (let i = 0; i < hues.length; i++) {
    for (let j = i + 1; j < hues.length; j++) {
      if (hueDistance(hues[i], hues[j]) < HUE_DISTANCE_THRESHOLD) {
        union(i, j);
      }
    }
  }

  const groups = new Map<number, Set<number>>();
  for (let i = 0; i < palette.length; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, new Set());
    groups.get(root)!.add(i);
  }

  const result = new Map<number, Set<number>>();
  for (const members of groups.values()) {
    if (members.size < 2) continue;
    for (const idx of members) result.set(idx, members);
  }
  return result;
};

const PALETTE_RGB: RGB[] = ZONE_QUALITATIVE_PALETTE.map(hexToRgb);

const HUE_GROUP_MAP = buildHueGroupMap(ZONE_QUALITATIVE_PALETTE);

const colorDistSq = (a: RGB, b: RGB): number =>
  (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

export const assignZoneColors = (zones: Zones): Record<ZoneId, string> => {
  const assignment: Record<ZoneId, number> = {};
  const result: Record<ZoneId, string> = {};

  const sortedIds = Object.values(zones)
    .sort((a, b) => b.adjacentZones.length - a.adjacentZones.length)
    .map((z) => z.id);

  for (const zoneId of sortedIds) {
    const zone = zones[zoneId];
    const usedIndices = new Set<number>();
    for (const nid of zone.adjacentZones) {
      if (nid in assignment) usedIndices.add(assignment[nid]);
    }

    const blockedIndices = new Set<number>(usedIndices);
    for (const usedIdx of usedIndices) {
      const group = HUE_GROUP_MAP.get(usedIdx);
      if (group) {
        for (const gi of group) blockedIndices.add(gi);
      }
    }

    let chosen: number | null = null;
    for (let i = 0; i < ZONE_QUALITATIVE_PALETTE.length; i++) {
      if (!blockedIndices.has(i)) {
        chosen = i;
        break;
      }
    }

    if (chosen === null) {
      let bestIdx = 0;
      let bestMinDist = -1;
      for (let i = 0; i < ZONE_QUALITATIVE_PALETTE.length; i++) {
        if (usedIndices.has(i)) continue;
        let minDist = Infinity;
        for (const usedIdx of usedIndices) {
          minDist = Math.min(
            minDist,
            colorDistSq(PALETTE_RGB[i], PALETTE_RGB[usedIdx]),
          );
        }
        if (minDist > bestMinDist) {
          bestMinDist = minDist;
          bestIdx = i;
        }
      }
      chosen = bestIdx;
    }

    assignment[zoneId] = chosen;
    result[zoneId] = ZONE_QUALITATIVE_PALETTE[chosen];
  }

  return result;
};
