import { getDbWorker } from "./get-db-worker";

export const exportDb = async (): Promise<Blob> => {
  const worker = getDbWorker();
  const bytes = await worker.exportDb();
  return new Blob([bytes], { type: "application/octet-stream" });
};
