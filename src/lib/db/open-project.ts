import { getDbWorker } from "./get-db-worker";

export type OpenProjectResult = {
  status: "ok" | "migrated" | "too-new";
  fileVersion: number;
  appVersion: number;
};

export const openProject = async (dbFile: File): Promise<OpenProjectResult> => {
  const arrayBuffer = await dbFile.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const worker = getDbWorker();
  return worker.openDb(bytes);
};
