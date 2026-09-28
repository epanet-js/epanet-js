import { atom } from "jotai";
import type { SessionHistory } from "src/lib/persistence/session-history";
import type { SimulationState } from "src/state/simulation";
import type { SimulationSettings } from "src/simulation/simulation-settings";
import { HydraulicModel } from "src/hydraulic-model";
import { LabelManager } from "@epanet-js/hydraulic-model";

export type BranchState = {
  version: string;
  hydraulicModel: HydraulicModel;
  labelManager: LabelManager;
  sessionHistory: SessionHistory;
  simulation: SimulationState | null;
  simulationSourceId: string;
  simulationSettings: SimulationSettings;
};

export type UnloadedBranchState = Omit<
  BranchState,
  "hydraulicModel" | "labelManager"
>;

export const isBranchLoaded = (
  state: BranchState | UnloadedBranchState,
): state is BranchState => "hydraulicModel" in state;

export const branchStateAtom = atom(
  new Map<string, BranchState | UnloadedBranchState>(),
);
