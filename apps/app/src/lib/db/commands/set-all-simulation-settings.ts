import type { SimulationSettings } from "src/simulation/simulation-settings";
import { getWorker, timed } from "@epanet-js/ejsdb";
import { serializeSimulationSettings } from "../mappers/simulation-settings/to-rows";

export const setAllSimulationSettings = async (
  settings: SimulationSettings,
): Promise<void> => {
  await timed("setAllSimulationSettings", async () => {
    const data = serializeSimulationSettings(settings);
    const worker = getWorker();
    await worker.setAllSimulationSettings(data);
  });
};
