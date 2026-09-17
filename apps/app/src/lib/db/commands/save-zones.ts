import type { Zones } from "src/lib/zones";
import type { IdPoolSeeds } from "@epanet-js/id-generator";
import { getWorker, timed } from "@epanet-js/ejsdb";
import { serializeIdPools } from "@epanet-js/ejsdb-mappers";
import { serializeZones } from "../mappers/zones/to-rows";

export const saveZones = async (
  zones: Zones,
  idPools: IdPoolSeeds | null,
): Promise<void> => {
  await timed("saveZones", async () => {
    const rows = serializeZones(zones);
    const worker = getWorker();
    await worker.setAllZones(
      rows,
      idPools === null ? null : serializeIdPools(idPools),
    );
  });
};
