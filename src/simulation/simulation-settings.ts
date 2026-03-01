import { nanoid } from "nanoid";

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

export type DemandSettings = {
  globalMultiplier: number;
};

export const defaultDemandSettings: DemandSettings = {
  globalMultiplier: 1,
};

export type SimulationSettings = {
  version: string;
  timing: Timing;
  demands: DemandSettings;
};

export const defaultSimulationSettings: SimulationSettings = {
  version: nanoid(),
  timing: defaultTiming,
  demands: defaultDemandSettings,
};
