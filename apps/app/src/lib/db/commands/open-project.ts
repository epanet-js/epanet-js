import { getWorker, timed, type OpenDbResult } from "@epanet-js/ejsdb";
import { reportSessionHistoryFailure } from "./session-history";

export type OpenProjectResult = OpenDbResult;

export const openProject = async (dbFile: File): Promise<OpenProjectResult> => {
  return timed(
    "openProject",
    async () => {
      const arrayBuffer = await dbFile.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const worker = getWorker();
      const result = await worker.openDb(bytes);
      await reportSessionHistoryFailure();
      return result;
    },
    { bytes: dbFile.size },
  );
};
