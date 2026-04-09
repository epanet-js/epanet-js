import { atom } from "jotai";
import type { MomentLog } from "src/lib/persistence/moment-log";
import type { ResultsReader } from "src/simulation/results-reader";
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
  simulationSourceId: string;
  simulationSettings: SimulationSettings;
  simulationResults: ResultsReader | null;
};

export const branchStateAtom = atom(new Map<string, BranchState>());
