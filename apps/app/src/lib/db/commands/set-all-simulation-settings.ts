import { getWorker, timed } from "@epanet-js/ejsdb";

export const setAllSimulationSettings = async (data: string): Promise<void> => {
  await timed("setAllSimulationSettings", async () => {
    const worker = getWorker();
    await worker.setAllSimulationSettings(data);
  });
};
