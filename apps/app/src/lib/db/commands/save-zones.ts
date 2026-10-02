import type { Zones } from "@epanet-js/hydraulic-model";
import { getWorker, timed } from "@epanet-js/ejsdb";
import { zonesToRows } from "@epanet-js/ejsdb-mappers";

export const saveZones = async (zones: Zones): Promise<void> => {
  await timed("saveZones", async () => {
    const rows = zonesToRows(zones);
    const worker = getWorker();
    await worker.setAllZones(rows);
  });
};
