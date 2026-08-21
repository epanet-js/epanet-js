import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import type { HydraulicModel } from "src/hydraulic-model";
import {
  initializeModelFactories,
  type LabelManager,
} from "@epanet-js/hydraulic-model";
import { branchStateAtom } from "src/state/branch-state";
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
    initializeModelFactories({
      idGenerator: currentFactories.idGenerator,
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

export const useSwitchBranch = () => {
  const switchBranch = useAtomCallback(
    useCallback((get: Getter, set: Setter, branchId: string) => {
      const branchStates = get(branchStateAtom);

      const targetState = branchStates.get(branchId);
      if (!targetState) {
        throw new Error(`Branch state not found for ${branchId}`);
      }

      updateFactories(get, set, targetState.labelManager);
      set(mapEditionsTrackerAtom, new MapEditionsTracker());
      validateSelection(get, set, targetState.hydraulicModel);
    }, []),
  );

  return { switchBranch };
};
