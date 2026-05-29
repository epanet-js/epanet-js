import type { BBox } from "@turf/helpers";
import type { Zones, ZoneId } from "./zones";

export const bboxOverlaps = (a: BBox, b: BBox): boolean =>
  a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

export const computeAdjacency = (zones: Zones): Map<ZoneId, ZoneId[]> => {
  const entries = Object.values(zones);
  const adj = new Map<ZoneId, Set<ZoneId>>();

  for (const z of entries) {
    adj.set(z.id, new Set());
  }

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      if (bboxOverlaps(entries[i].bbox, entries[j].bbox)) {
        adj.get(entries[i].id)!.add(entries[j].id);
        adj.get(entries[j].id)!.add(entries[i].id);
      }
    }
  }

  const result = new Map<ZoneId, ZoneId[]>();
  for (const [id, neighbors] of adj) {
    result.set(id, Array.from(neighbors));
  }
  return result;
};
