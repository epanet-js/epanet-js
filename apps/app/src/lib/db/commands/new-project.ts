import { getWorker, timed } from "@epanet-js/ejsdb";

export const newProject = async (): Promise<void> => {
  await timed("newProject", async () => {
    const worker = getWorker();
    const result = await worker.newDb();
    if (result.status !== "ok") {
      throw new Error(`newDb storage error: ${result.errorDetails}`);
    }
  });
};
