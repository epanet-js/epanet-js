import { nanoid } from "nanoid";

export type DemandModel = "DDA" | "PDA";

export type Timing = {
  duration: number;
  hydraulicTimestep: number;
  reportTimestep: number;
  patternTimestep: number;
  qualityTimestep?: number;
  ruleTimestep?: number;
};

export const defaultTiming: Timing = {
  duration: 0,
  hydraulicTimestep: 3600,
  reportTimestep: 3600,
  patternTimestep: 3600,
};

export type SimulationSettings = {
  version: string;
  timing: Timing;
  globalDemandMultiplier: number;
  demandModel: DemandModel;
  minimumPressure: number;
  requiredPressure: number;
  pressureExponent: number;
  emitterExponent: number;
};

export const defaultSimulationSettings: SimulationSettings = {
  version: nanoid(),
  timing: defaultTiming,
  globalDemandMultiplier: 1,
  demandModel: "DDA",
  minimumPressure: 0,
  requiredPressure: 0.1,
  pressureExponent: 0.5,
  emitterExponent: 0.5,
};
