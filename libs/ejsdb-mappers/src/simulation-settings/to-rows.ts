import {
  simulationSettingsSchema,
  type SimulationSettingsData,
} from "@epanet-js/ejsdb";

export const serializeSimulationSettings = (
  settings: SimulationSettingsData,
): string => {
  const result = simulationSettingsSchema.safeParse(settings);
  if (!result.success) {
    throw new Error(
      `Simulation settings: data does not match schema — ${result.error.message}`,
    );
  }
  return JSON.stringify(result.data);
};
