import { atom } from "jotai";
import {
  SimulationSettings,
  defaultSimulationSettings,
} from "src/simulation/simulation-settings";

export const simulationSettingsAtom = atom<SimulationSettings>(
  defaultSimulationSettings,
);
