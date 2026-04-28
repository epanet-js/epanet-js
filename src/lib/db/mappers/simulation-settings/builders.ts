import {
  defaultSimulationSettings,
  type SimulationSettings,
} from "src/simulation/simulation-settings";
import { simulationSettingsSchema } from "./schema";

export const buildSimulationSettingsData = (
  data: string | null,
): SimulationSettings => {
  if (data === null) return defaultSimulationSettings;

  let raw: unknown;
  try {
    raw = JSON.parse(data);
  } catch (error) {
    throw new Error("Simulation settings: data is not valid JSON", {
      cause: error,
    });
  }

  const result = simulationSettingsSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Simulation settings: data does not match schema — ${result.error.message}`,
    );
  }
  return result.data;
};
