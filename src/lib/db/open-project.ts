import { getDbWorker } from "./get-db-worker";
import { timed } from "./perf-log";

export type OpenProjectResult = {
  status: "ok" | "migrated" | "too-new";
  fileVersion: number;
  appVersion: number;
};

export const openProject = async (dbFile: File): Promise<OpenProjectResult> => {
  return timed(
    "openProject",
    async () => {
      const arrayBuffer = await dbFile.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const worker = getDbWorker();
      return worker.openDb(bytes);
    },
    { bytes: dbFile.size },
  );
};
