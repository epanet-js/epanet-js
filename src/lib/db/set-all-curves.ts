import type { Curves } from "src/hydraulic-model/curves";
import { getDbWorker } from "./get-db-worker";
import { timed } from "./perf-log";
import { curvesToRows } from "./mappers/curves/to-rows";

export const setAllCurves = async (curves: Curves): Promise<void> => {
  await timed("setAllCurves", async () => {
    const rows = curvesToRows(curves);
    const worker = getDbWorker();
    await worker.setAllCurves(rows);
  });
};
