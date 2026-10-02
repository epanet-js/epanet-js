import {
  simulationSettingsSchema,
  type SimulationSettingsData,
} from "@epanet-js/ejsdb";

export const buildSimulationSettingsData = (
  data: string | null,
  defaults: SimulationSettingsData,
): SimulationSettingsData => {
  if (data === null) return defaults;

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
