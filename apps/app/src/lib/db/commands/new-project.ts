import { getWorker, timed } from "@epanet-js/ejsdb";

export const newProject = async (): Promise<void> => {
  await timed("newProject", async () => {
    const worker = getWorker();
    await worker.newDb();
  });
};
