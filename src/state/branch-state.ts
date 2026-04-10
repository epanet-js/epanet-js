import { atom } from "jotai";
import type { MomentLog } from "src/lib/persistence/moment-log";
import type { SimulationState } from "src/state/simulation";
import type { SimulationSettings } from "src/simulation/simulation-settings";
import { HydraulicModel } from "src/hydraulic-model";
import { LabelManager } from "src/hydraulic-model/label-manager";

export type BranchState = {
  version: string;
  hydraulicModel: HydraulicModel;
  labelManager: LabelManager;
  momentLog: MomentLog;
  simulation: SimulationState | null;
  simulationSettings: SimulationSettings;
};

export const branchStateAtom = atom(new Map<string, BranchState>());
