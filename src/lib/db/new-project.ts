import { getDbWorker } from "./get-db-worker";

export const newProject = async (): Promise<void> => {
  const worker = getDbWorker();
  await worker.newDb();
};
