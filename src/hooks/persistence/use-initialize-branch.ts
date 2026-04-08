import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import { copyModel } from "src/hydraulic-model";
import { initializeModelFactories } from "src/hydraulic-model/factories";
import { LabelManager } from "src/hydraulic-model/label-manager";
import { MomentLog } from "src/lib/persistence/moment-log";
import { USelection } from "src/selection";
import { branchStateAtom } from "src/state/branch-state";
import { modelFactoriesAtom } from "src/state/model-factories";
import { projectSettingsAtom } from "src/state/project-settings";
import { selectionAtom } from "src/state/selection";
import { simulationSettingsAtom } from "src/state/simulation-settings";
import { worktreeAtom } from "src/state/scenarios";
import type { Branch } from "src/lib/worktree/types";

export const useInitializeBranch = () => {
  const initializeBranch = useAtomCallback(
    useCallback((get: Getter, set: Setter, branch: Branch) => {
      const worktree = get(worktreeAtom);
      const branchStates = get(branchStateAtom);
      const mainState = branchStates.get(worktree.mainId);
      if (!mainState) {
        throw new Error("Main branch state not found");
      }

      const currentFactories = get(modelFactoriesAtom);
      const currentSettings = get(simulationSettingsAtom);
      const labelManager = new LabelManager(
        new Map(currentFactories.labelCounters),
      );
      const hydraulicModel = copyModel(mainState.hydraulicModel);

      const updatedBranchStates = new Map(branchStates);

      updatedBranchStates.set(worktree.mainId, {
        ...mainState,
        simulationSettings: currentSettings,
      });

      updatedBranchStates.set(branch.id, {
        version: mainState.version,
        hydraulicModel,
        labelManager,
        momentLog: new MomentLog(),
        simulation: mainState.simulation,
        simulationSourceId: mainState.simulationSourceId,
        simulationSettings: currentSettings,
      });

      set(branchStateAtom, updatedBranchStates);

      set(
        modelFactoriesAtom,
        initializeModelFactories({
          idGenerator: currentFactories.idGenerator,
          labelManager,
          defaults: get(projectSettingsAtom).defaults,
          labelCounters: currentFactories.labelCounters,
        }),
      );

      const selection = get(selectionAtom);
      const validatedSelection = USelection.clearInvalidIds(
        selection,
        hydraulicModel.assets,
        hydraulicModel.customerPoints,
      );
      set(selectionAtom, { ...validatedSelection });
    }, []),
  );

  return { initializeBranch };
};
