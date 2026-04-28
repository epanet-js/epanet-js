import type { SimulationSettings } from "src/simulation/simulation-settings";
import { simulationSettingsSchema } from "./schema";

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
