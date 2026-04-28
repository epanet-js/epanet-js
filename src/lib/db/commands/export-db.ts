import { getDbWorker } from "../get-db-worker";
import { timedWith } from "../perf-log";

export const exportDb = async (): Promise<Blob> => {
  return timedWith(
    "exportDb",
    async () => {
      const worker = getDbWorker();
      const bytes = await worker.exportDb();
      return new Blob([bytes], { type: "application/octet-stream" });
    },
    (blob) => ({ bytes: blob.size }),
  );
};
