import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import type { HydraulicModel } from "src/hydraulic-model";
import { initializeModelFactories } from "src/hydraulic-model/factories";
import type { LabelManager } from "src/hydraulic-model/label-manager";
import { branchStateAtom } from "src/state/branch-state";
import { modelFactoriesAtom } from "src/state/model-factories";
import { mapSyncMomentAtom } from "src/state/map";
import { simulationResultsAtom } from "src/state/simulation";
import { selectionAtom } from "src/state/selection";
import { projectSettingsAtom } from "src/state/project-settings";
import { USelection } from "src/selection";
import type { MomentLog } from "src/lib/persistence/moment-log";
import { prepareSimulation } from "./simulation-helpers";

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

function syncMapMoment(get: Getter, set: Setter, momentLog: MomentLog): void {
  const current = get(mapSyncMomentAtom);
  set(mapSyncMomentAtom, {
    pointer: momentLog.getPointer(),
    version: current.version + 1,
  });
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

export const useSwitchBranch = () => {
  const switchBranch = useAtomCallback(
    useCallback(async (get: Getter, set: Setter, branchId: string) => {
      const branchStates = get(branchStateAtom);

      const targetState = branchStates.get(branchId);
      if (!targetState) {
        throw new Error(`Branch state not found for ${branchId}`);
      }

      const { resultsReader } = await prepareSimulation(
        get,
        targetState.simulation,
        targetState.simulationSourceId,
      );

      set(simulationResultsAtom, resultsReader);
      updateFactories(get, set, targetState.labelManager);
      syncMapMoment(get, set, targetState.momentLog);
      validateSelection(get, set, targetState.hydraulicModel);
    }, []),
  );

  return { switchBranch };
};
