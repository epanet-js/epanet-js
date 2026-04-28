import type { Controls } from "src/hydraulic-model/controls";
import { getDbWorker } from "./get-db-worker";
import { timed } from "./perf-log";
import { serializeControls } from "./mappers/controls/to-rows";

export const setAllControls = async (controls: Controls): Promise<void> => {
  await timed("setAllControls", async () => {
    const data = serializeControls(controls);
    const worker = getDbWorker();
    await worker.setAllControls(data);
  });
};
