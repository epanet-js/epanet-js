import { nanoid } from "nanoid";

export type EPSTiming = {
  duration?: number;
  hydraulicTimestep?: number;
  reportTimestep?: number;
  patternTimestep?: number;
};

export type SimulationSettings = {
  version: string;
  epsTiming: EPSTiming;
};

export const defaultSimulationSettings: SimulationSettings = {
  version: nanoid(),
  epsTiming: {},
};
