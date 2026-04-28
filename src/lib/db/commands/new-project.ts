import { getDbWorker } from "../get-db-worker";
import { timed } from "../perf-log";

export const newProject = async (): Promise<void> => {
  await timed("newProject", async () => {
    const worker = getDbWorker();
    await worker.newDb();
  });
};
