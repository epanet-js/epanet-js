import { atom } from "jotai";
import type { Getter, Setter } from "jotai";
import type { HydraulicModel } from "src/hydraulic-model";
import type { BranchState } from "src/lib/worktree/types";
import { MomentLog } from "src/lib/persistence/moment-log";
import { USelection } from "src/selection/selection";
import { branchStateAtom } from "src/state/branch-state";
import { dataAtom } from "src/state/data";
import { fileInfoAtom } from "src/state/file-system";
import { nullHydraulicModel } from "src/state/hydraulic-model";
import { worktreeAtom } from "src/state/scenarios";
import {
  type SimulationState,
  initialSimulationState,
} from "src/state/simulation";
import {
  type SimulationSettings,
  defaultSimulationSettings,
} from "src/simulation/simulation-settings";

function getActiveBranchState(get: Getter): BranchState | undefined {
  const worktree = get(worktreeAtom);
  return get(branchStateAtom).get(worktree.activeSnapshotId);
}

function updateActiveBranchState(
  get: Getter,
  set: Setter,
  update: Partial<BranchState>,
): void {
  const worktree = get(worktreeAtom);
  const branchStates = get(branchStateAtom);
  const currentState = branchStates.get(worktree.activeSnapshotId);
  if (!currentState) return;
  const updated = new Map(branchStates);
  updated.set(worktree.activeSnapshotId, { ...currentState, ...update });
  set(branchStateAtom, updated);
}

export const stagingModelDerivedAtom = atom(
  (get): HydraulicModel => {
    return getActiveBranchState(get)?.hydraulicModel ?? nullHydraulicModel;
  },
  (get, set, value: HydraulicModel) => {
    updateActiveBranchState(get, set, {
      hydraulicModel: value,
      version: value.version,
    });
  },
);

export const baseModelDerivedAtom = atom((get): HydraulicModel => {
  const worktree = get(worktreeAtom);
  const branchStates = get(branchStateAtom);
  return (
    branchStates.get(worktree.mainId)?.hydraulicModel ?? nullHydraulicModel
  );
});

export const momentLogDerivedAtom = atom(
  (get): MomentLog => {
    return getActiveBranchState(get)?.momentLog ?? new MomentLog();
  },
  (get, set, value: MomentLog) => {
    updateActiveBranchState(get, set, { momentLog: value });
  },
);

export const simulationDerivedAtom = atom(
  (get): SimulationState => {
    return getActiveBranchState(get)?.simulation ?? initialSimulationState;
  },
  (get, set, value: SimulationState) => {
    updateActiveBranchState(get, set, {
      simulation: value,
      simulationSourceId: get(worktreeAtom).activeSnapshotId,
    });
  },
);

export const simulationSettingsDerivedAtom = atom(
  (get): SimulationSettings => {
    return (
      getActiveBranchState(get)?.simulationSettings ?? defaultSimulationSettings
    );
  },
  (get, set, value: SimulationSettings) => {
    updateActiveBranchState(get, set, { simulationSettings: value });
  },
);

export const assetsDerivedAtom = atom((get) => {
  return get(stagingModelDerivedAtom).assets;
});

export const patternsDerivedAtom = atom((get) => {
  return get(stagingModelDerivedAtom).patterns;
});

export const customerPointsDerivedAtom = atom((get) => {
  return get(stagingModelDerivedAtom).customerPoints;
});

export const selectedFeaturesDerivedAtom = atom((get) => {
  const data = get(dataAtom);
  const hydraulicModel = get(stagingModelDerivedAtom);
  return USelection.getSelectedFeatures({ ...data, hydraulicModel });
});

export const hasUnsavedChangesDerivedAtom = atom<boolean>((get) => {
  const fileInfo = get(fileInfoAtom);
  const momentLog = get(momentLogDerivedAtom);
  const hydraulicModel = get(stagingModelDerivedAtom);

  if (fileInfo) {
    return fileInfo.modelVersion !== hydraulicModel.version;
  }

  return momentLog.getDeltas().length > 0;
});
