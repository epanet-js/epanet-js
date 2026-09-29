import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import type { HydraulicModel } from "src/hydraulic-model";
import {
  initializeModelFactoriesWithPools,
  type LabelManager,
} from "@epanet-js/hydraulic-model";
import { branchStateAtom, isBranchLoaded } from "src/state/branch-state";
import { worktreeAtom } from "src/state/scenarios";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { unloadBranch } from "./use-initialize-branch";
import { modelFactoriesAtom } from "src/state/model-factories";
import { mapEditionsTrackerAtom } from "src/state/map";
import { MapEditionsTracker } from "src/map/map-editions-tracker";
import { selectionAtom } from "src/state/selection";
import { USelection } from "src/selection";

function updateFactories(
  get: Getter,
  set: Setter,
  labelManager: LabelManager,
): void {
  const currentFactories = get(modelFactoriesAtom);
  set(
    modelFactoriesAtom,
    initializeModelFactoriesWithPools({
      idPools: currentFactories.idPools,
      labelManager,
      labelCounters: currentFactories.labelCounters,
    }),
  );
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

function unloadOtherScenarios(get: Getter, set: Setter, branchId: string) {
  const { mainId } = get(worktreeAtom);
  if (branchId === mainId) return;

  const branchStates = get(branchStateAtom);
  const toUnload = [...branchStates].filter(
    ([id, state]) => id !== mainId && id !== branchId && isBranchLoaded(state),
  );
  if (toUnload.length === 0) return;

  const updated = new Map(branchStates);
  for (const [id, state] of toUnload) updated.set(id, unloadBranch(state));
  set(branchStateAtom, updated);
}

export const useSwitchBranch = () => {
  const isLazyScenariosOn = useFeatureFlag("FLAG_LAZY_SCENARIOS");

  const switchBranch = useAtomCallback(
    useCallback(
      (get: Getter, set: Setter, branchId: string) => {
        const targetState = get(branchStateAtom).get(branchId);
        if (!targetState || !isBranchLoaded(targetState)) {
          throw new Error(`Branch state not found for ${branchId}`);
        }

        if (isLazyScenariosOn) unloadOtherScenarios(get, set, branchId);

        updateFactories(get, set, targetState.labelManager);
        set(mapEditionsTrackerAtom, new MapEditionsTracker());
        validateSelection(get, set, targetState.hydraulicModel);
      },
      [isLazyScenariosOn],
    ),
  );

  return { switchBranch };
};
