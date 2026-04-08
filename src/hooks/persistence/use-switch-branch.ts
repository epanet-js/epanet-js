import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import type { HydraulicModel } from "src/hydraulic-model";
import { initializeModelFactories } from "src/hydraulic-model/factories";
import type { LabelManager } from "src/hydraulic-model/label-manager";
import { branchStateAtom } from "src/state/branch-state";
import { modelFactoriesAtom } from "src/state/model-factories";
import { stagingModelAtom, baseModelAtom } from "src/state/hydraulic-model";
import { momentLogAtom } from "src/state/model-changes";
import { mapSyncMomentAtom } from "src/state/map";
import { simulationAtom, simulationResultsAtom } from "src/state/simulation";
import { simulationSettingsAtom } from "src/state/simulation-settings";
import { selectionAtom } from "src/state/selection";
import { projectSettingsAtom } from "src/state/project-settings";
import { worktreeAtom } from "src/state/scenarios";
import { USelection } from "src/selection";
import type { MomentLog } from "src/lib/persistence/moment-log";
import { prepareSimulation, type ResultsReader } from "./simulation-helpers";

type SimulationState = import("src/state/simulation").SimulationState;

function setModelState(
  set: Setter,
  stagingModel: HydraulicModel,
  baseModel: HydraulicModel,
): void {
  set(stagingModelAtom, stagingModel);
  set(baseModelAtom, baseModel);
}

function updateFactories(
  get: Getter,
  set: Setter,
  labelManager: LabelManager,
): void {
  const currentFactories = get(modelFactoriesAtom);
  set(
    modelFactoriesAtom,
    initializeModelFactories({
      idGenerator: currentFactories.idGenerator,
      labelManager,
      defaults: get(projectSettingsAtom).defaults,
      labelCounters: currentFactories.labelCounters,
    }),
  );
}

function switchMomentLog(get: Getter, set: Setter, momentLog: MomentLog): void {
  const current = get(mapSyncMomentAtom);
  set(momentLogAtom, momentLog);
  set(mapSyncMomentAtom, {
    pointer: momentLog.getPointer(),
    version: current.version + 1,
  });
}

function setSimulationState(
  set: Setter,
  simulation: SimulationState,
  resultsReader: ResultsReader,
  simulationSettings: import("src/simulation/simulation-settings").SimulationSettings,
): void {
  set(simulationAtom, simulation);
  set(simulationResultsAtom, resultsReader);
  set(simulationSettingsAtom, simulationSettings);
}

function validateSelection(
  get: Getter,
  set: Setter,
  model: HydraulicModel,
): void {
  const selection = get(selectionAtom);
  const validatedSelection = USelection.clearInvalidIds(
    selection,
    model.assets,
    model.customerPoints,
  );
  set(selectionAtom, { ...validatedSelection });
}

function saveOutgoingBranchState(
  get: Getter,
  set: Setter,
): Map<string, import("src/lib/worktree/types").BranchState> {
  const worktree = get(worktreeAtom);
  const branchStates = get(branchStateAtom);
  const currentState = branchStates.get(worktree.activeSnapshotId);
  if (!currentState) return branchStates;

  const currentSettings = get(simulationSettingsAtom);
  const currentSimulation = get(simulationAtom);
  const updatedStates = new Map(branchStates);
  updatedStates.set(worktree.activeSnapshotId, {
    ...currentState,
    simulationSettings: currentSettings,
    simulation: currentSimulation,
  });
  set(branchStateAtom, updatedStates);
  return updatedStates;
}

export const useSwitchBranch = () => {
  const switchBranch = useAtomCallback(
    useCallback(async (get: Getter, set: Setter, branchId: string) => {
      const branchStates = saveOutgoingBranchState(get, set);

      const worktree = get(worktreeAtom);
      const targetState = branchStates.get(branchId);
      if (!targetState) {
        throw new Error(`Branch state not found for ${branchId}`);
      }
      const mainState = branchStates.get(worktree.mainId);
      if (!mainState) {
        throw new Error("Main branch state not found");
      }

      const { finalSimulation, resultsReader } = await prepareSimulation(
        get,
        targetState.simulation,
        targetState.simulationSourceId,
      );

      setModelState(set, targetState.hydraulicModel, mainState.hydraulicModel);
      updateFactories(get, set, targetState.labelManager);
      switchMomentLog(get, set, targetState.momentLog);
      setSimulationState(
        set,
        finalSimulation,
        resultsReader,
        targetState.simulationSettings,
      );
      validateSelection(get, set, targetState.hydraulicModel);
    }, []),
  );

  return { switchBranch };
};
