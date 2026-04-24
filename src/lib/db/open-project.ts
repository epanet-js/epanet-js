import { getDbWorker } from "./get-db-worker";
import { timed } from "./perf-log";

export type OpenDbResult =
  | { status: "ok"; fileVersion: number; appVersion: number }
  | { status: "migrated"; fileVersion: number; appVersion: number }
  | { status: "too-new"; fileVersion: number; appVersion: number }
  | { status: "corrupt"; errorDetails: string }
  | { status: "internal"; errorDetails: string }
  | {
      status: "migration-failed";
      errorDetails: string;
      fileVersion: number;
      appVersion: number;
    };

export type OpenProjectResult = OpenDbResult;

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
