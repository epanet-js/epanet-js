import type { Zones, ZoneId } from "src/lib/zones";
import { hexToRgb, colorDistSq, buildHueGroupMap } from "./hue-distance";

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

const HUE_DISTANCE_THRESHOLD = 40;

const PALETTE_RGB = ZONE_QUALITATIVE_PALETTE.map(hexToRgb);

const HUE_GROUP_MAP = buildHueGroupMap(
  ZONE_QUALITATIVE_PALETTE,
  HUE_DISTANCE_THRESHOLD,
);

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
