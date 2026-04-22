import type { AssetId } from "src/hydraulic-model/assets-map";
import type {
  Demand,
  JunctionAssignedDemands,
} from "src/hydraulic-model/demands";
import type { JunctionDemandRow } from "./rows";
import { parsePatternIdOrUndefined } from "./parse-pattern-id";

export const buildJunctionDemandsData = (
  rows: JunctionDemandRow[],
): JunctionAssignedDemands => {
  const junctions: JunctionAssignedDemands = new Map<AssetId, Demand[]>();
  for (const row of rows) {
    const list = junctions.get(row.junction_id) ?? [];
    list.push({
      baseDemand: row.base_demand,
      patternId: parsePatternIdOrUndefined(row.pattern_id),
    });
    junctions.set(row.junction_id, list);
  }
  return junctions;
};
