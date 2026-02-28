import { nanoid } from "nanoid";

export type Timing = {
  duration: number;
  hydraulicTimestep: number;
  reportTimestep: number;
  patternTimestep: number;
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
};

export const defaultSimulationSettings: SimulationSettings = {
  version: nanoid(),
  timing: defaultTiming,
};
