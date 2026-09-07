import { getWorker, timed } from "@epanet-js/ejsdb";
import type { ChangeSet, Direction } from "@epanet-js/change-set";

export const applyChangeSetToDb = async (
  changeSet: ChangeSet,
  direction: Direction,
): Promise<void> => {
  await timed("applyChangeSetToDb", async () => {
    const worker = getWorker();
    await worker.applyChangeSet(changeSet.bytes, direction);
  });
};
