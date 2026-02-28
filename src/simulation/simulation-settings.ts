import { EPSTiming } from "src/hydraulic-model/eps-timing";

export type SimulationSettings = {
  epsTiming: EPSTiming;
};

export const defaultSimulationSettings: SimulationSettings = {
  epsTiming: {},
};
