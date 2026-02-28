import { nanoid } from "nanoid";
import { EPSTiming } from "src/hydraulic-model/eps-timing";

export type SimulationSettings = {
  version: string;
  epsTiming: EPSTiming;
};

export const defaultSimulationSettings: SimulationSettings = {
  version: nanoid(),
  epsTiming: {},
};
