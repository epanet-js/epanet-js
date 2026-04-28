import type { SimulationSettings } from "src/simulation/simulation-settings";
import { getDbWorker } from "../get-db-worker";
import { timed } from "../perf-log";
import { serializeSimulationSettings } from "../mappers/simulation-settings/to-rows";

export const setAllSimulationSettings = async (
  settings: SimulationSettings,
): Promise<void> => {
  await timed("setAllSimulationSettings", async () => {
    const data = serializeSimulationSettings(settings);
    const worker = getDbWorker();
    await worker.setAllSimulationSettings(data);
  });
};
