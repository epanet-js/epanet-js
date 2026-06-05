import type { Zones, ZoneId } from "src/lib/zones";
import { computeAdjacency } from "src/lib/zones/zone-adjacency";
import {
  hexToRgb,
  colorDistSq,
  buildHueGroupMap,
  type RGB,
} from "./hue-distance";

const HUE_DISTANCE_THRESHOLD = 40;

let cachedPalette: string[] | null = null;
let cachedRgb: RGB[] = [];
let cachedHueMap: Map<number, Set<number>> = new Map();

export const assignZoneColors = (
  zones: Zones,
  palette: string[],
): Record<ZoneId, string> => {
  if (palette !== cachedPalette) {
    cachedPalette = palette;
    cachedRgb = palette.map(hexToRgb);
    cachedHueMap = buildHueGroupMap(palette, HUE_DISTANCE_THRESHOLD);
  }

  const adjacency = computeAdjacency(zones);

  const assignment: Record<ZoneId, number> = {};
  const result: Record<ZoneId, string> = {};

  const sortedIds = Object.values(zones)
    .sort(
      (a, b) =>
        (adjacency.get(b.id)?.length ?? 0) - (adjacency.get(a.id)?.length ?? 0),
    )
    .map((z) => z.id);

  for (const zoneId of sortedIds) {
    const neighbors = adjacency.get(zoneId) ?? [];
    const usedIndices = new Set<number>();
    for (const nid of neighbors) {
      if (nid in assignment) usedIndices.add(assignment[nid]);
    }

    const blockedIndices = new Set<number>(usedIndices);
    for (const usedIdx of usedIndices) {
      const group = cachedHueMap.get(usedIdx);
      if (group) {
        for (const gi of group) blockedIndices.add(gi);
      }
    }

    let chosen: number | null = null;
    for (let i = 0; i < palette.length; i++) {
      if (!blockedIndices.has(i)) {
        chosen = i;
        break;
      }
    }

    if (chosen === null) {
      let bestIdx = 0;
      let bestMinDist = -1;
      for (let i = 0; i < palette.length; i++) {
        if (usedIndices.has(i)) continue;
        let minDist = Infinity;
        for (const usedIdx of usedIndices) {
          minDist = Math.min(
            minDist,
            colorDistSq(cachedRgb[i], cachedRgb[usedIdx]),
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
    result[zoneId] = palette[chosen];
  }

  return result;
};
