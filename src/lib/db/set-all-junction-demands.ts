import type { AssetId } from "src/hydraulic-model/asset-types/base-asset";
import type {
  Demand,
  JunctionAssignedDemands,
} from "src/hydraulic-model/demands";
import { getDbWorker } from "./get-db-worker";
import type { JunctionDemandRow } from "./rows";

export const toJunctionDemandRow = (
  junctionId: AssetId,
  demand: Demand,
  ordinal: number,
): JunctionDemandRow => ({
  junction_id: junctionId,
  ordinal,
  base_demand: demand.baseDemand,
  pattern_id: demand.patternId ?? null,
});

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

export const setAllJunctionDemands = async (
  junctions: JunctionAssignedDemands,
): Promise<void> => {
  const rows = junctionDemandsToRows(junctions);
  const worker = getDbWorker();
  await worker.setAllJunctionDemands(rows);
};
