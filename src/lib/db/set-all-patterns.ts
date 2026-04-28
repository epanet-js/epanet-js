import type { Patterns } from "src/hydraulic-model/patterns";
import { getDbWorker } from "./get-db-worker";
import { timed } from "./perf-log";
import { patternsToRows } from "./mappers/patterns/to-rows";

export const setAllPatterns = async (patterns: Patterns): Promise<void> => {
  await timed("setAllPatterns", async () => {
    const rows = patternsToRows(patterns);
    const worker = getDbWorker();
    await worker.setAllPatterns(rows);
  });
};
