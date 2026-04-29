import type { AssetId } from "src/hydraulic-model/asset-types/base-asset";
import type {
  Demand,
  JunctionAssignedDemands,
} from "src/hydraulic-model/demands";
import { junctionDemandRowSchema, type JunctionDemandRow } from "./schema";

export const toJunctionDemandRow = (
  junctionId: AssetId,
  demand: Demand,
  ordinal: number,
): JunctionDemandRow => {
  const candidate = {
    junction_id: junctionId,
    ordinal,
    base_demand: demand.baseDemand,
    pattern_id: demand.patternId ?? null,
  };
  const result = junctionDemandRowSchema.safeParse(candidate);
  if (!result.success) {
    throw new Error(
      `Junction ${junctionId} demand ${ordinal}: row does not match schema — ${result.error.message}`,
    );
  }
  return result.data;
};

export const junctionDemandsToRows = (
  junctions: JunctionAssignedDemands,
): JunctionDemandRow[] => {
  const rows: JunctionDemandRow[] = [];
  for (const [junctionId, demands] of junctions) {
    demands.forEach((demand, ordinal) => {
      rows.push(toJunctionDemandRow(junctionId, demand, ordinal));
    });
  }
  return rows;
};
