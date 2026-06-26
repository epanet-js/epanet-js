import type { PipeMaterial } from "@epanet-js/pipe-library";
import { getWorker, timed } from "@epanet-js/ejsdb";
import { serializePipeLibrary } from "@epanet-js/ejsdb-mappers";

export const savePipeLibrary = async (
  materials: PipeMaterial[],
): Promise<void> => {
  await timed("savePipeLibrary", async () => {
    const data = serializePipeLibrary(materials);
    const worker = getWorker();
    await worker.savePipeLibrary(data);
  });
};
