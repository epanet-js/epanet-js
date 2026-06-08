import type { Zones } from "src/lib/zones";
import { getWorker, timed } from "@epanet-js/ejsdb";
import { serializeZones } from "../mappers/zones/to-rows";

export const saveZones = async (zones: Zones): Promise<void> => {
  await timed("saveZones", async () => {
    const rows = serializeZones(zones);
    const worker = getWorker();
    await worker.setAllZones(rows);
  });
};
