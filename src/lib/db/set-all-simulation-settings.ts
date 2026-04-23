import type { SimulationSettings } from "src/simulation/simulation-settings";
import { getDbWorker } from "./get-db-worker";
import { timed } from "./perf-log";
import { simulationSettingsSchema } from "./build-simulation-settings-data";

export const serializeSimulationSettings = (
  settings: SimulationSettings,
): string => {
  const result = simulationSettingsSchema.safeParse(settings);
  if (!result.success) {
    throw new Error(
      `Simulation settings: data does not match schema — ${result.error.message}`,
    );
  }
  return JSON.stringify(result.data);
};

export const setAllSimulationSettings = async (
  settings: SimulationSettings,
): Promise<void> => {
  await timed("setAllSimulationSettings", async () => {
    const data = serializeSimulationSettings(settings);
    const worker = getDbWorker();
    await worker.setAllSimulationSettings(data);
  });
};
