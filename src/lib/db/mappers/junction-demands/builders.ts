import type { AssetId } from "src/hydraulic-model/assets-map";
import type {
  Demand,
  JunctionAssignedDemands,
} from "src/hydraulic-model/demands";
import { parseRows } from "../parse-rows";
import { junctionDemandRowSchema } from "./schema";

export const buildJunctionDemandsData = (
  rawRows: unknown[],
): JunctionAssignedDemands => {
  const rows = parseRows(junctionDemandRowSchema, rawRows, "JunctionDemands");
  const junctions: JunctionAssignedDemands = new Map<AssetId, Demand[]>();
  for (const row of rows) {
    const list = junctions.get(row.junction_id) ?? [];
    list.push({
      baseDemand: row.base_demand,
      patternId: row.pattern_id ?? undefined,
    });
    junctions.set(row.junction_id, list);
  }
  return junctions;
};
