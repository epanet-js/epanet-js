import type { JunctionAssignedDemands } from "src/hydraulic-model/demands";
import { getDbWorker } from "./get-db-worker";
import { timed } from "./perf-log";
import { junctionDemandsToRows } from "./mappers/junction-demands/to-rows";

export const setAllJunctionDemands = async (
  junctions: JunctionAssignedDemands,
): Promise<void> => {
  await timed("setAllJunctionDemands", async () => {
    const rows = junctionDemandsToRows(junctions);
    const worker = getDbWorker();
    await worker.setAllJunctionDemands(rows);
  });
};
