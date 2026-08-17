import { atom } from "jotai";
import type { MomentLog } from "src/lib/persistence/moment-log";
import type { ChangeTracker } from "src/lib/persistence/change-tracker";
import type { SimulationState } from "src/state/simulation";
import type { SimulationSettings } from "src/simulation/simulation-settings";
import { HydraulicModel } from "src/hydraulic-model";
import { LabelManager } from "@epanet-js/hydraulic-model";

export type BranchState = {
  version: string;
  hydraulicModel: HydraulicModel;
  labelManager: LabelManager;
  momentLog: MomentLog;
  changeTracker: ChangeTracker;
  simulation: SimulationState | null;
  simulationSourceId: string;
  simulationSettings: SimulationSettings;
};

export const branchStateAtom = atom(new Map<string, BranchState>());
