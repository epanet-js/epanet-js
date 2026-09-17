import { getWorker, timed } from "@epanet-js/ejsdb";
import type { ChangeSet, Direction } from "@epanet-js/change-set";
import type { IdPoolSeeds } from "@epanet-js/id-generator";
import { serializeIdPools } from "@epanet-js/ejsdb-mappers";

export const applyChangeSetToDb = async (
  changeSet: ChangeSet,
  direction: Direction,
  idPools: IdPoolSeeds | null,
): Promise<void> => {
  await timed(
    "changeSet:save",
    async () => {
      const worker = getWorker();
      await worker.applyChangeSet(
        changeSet.bytes,
        direction,
        idPools === null ? null : serializeIdPools(idPools),
      );
    },
    { direction, bytes: changeSet.byteLength },
  );
};
