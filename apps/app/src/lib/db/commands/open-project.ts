import { getWorker, timed, type OpenDbResult } from "src/lib/ejsdb";

export type OpenProjectResult = OpenDbResult;

export const openProject = async (dbFile: File): Promise<OpenProjectResult> => {
  return timed(
    "openProject",
    async () => {
      const arrayBuffer = await dbFile.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const worker = getWorker();
      return worker.openDb(bytes);
    },
    { bytes: dbFile.size },
  );
};
