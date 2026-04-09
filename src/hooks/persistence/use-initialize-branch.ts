import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import { copyModel } from "src/hydraulic-model";
import { LabelManager } from "src/hydraulic-model/label-manager";
import { MomentLog } from "src/lib/persistence/moment-log";
import { branchStateAtom } from "src/state/branch-state";
import { modelFactoriesAtom } from "src/state/model-factories";
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
      const labelManager = new LabelManager(
        new Map(currentFactories.labelCounters),
      );

      const updatedBranchStates = new Map(branchStates);
      updatedBranchStates.set(branch.id, {
        version: mainState.version,
        hydraulicModel: copyModel(mainState.hydraulicModel),
        labelManager,
        momentLog: new MomentLog(),
        simulation: mainState.simulation,
        simulationSourceId: mainState.simulationSourceId,
        simulationSettings: mainState.simulationSettings,
        simulationResults: mainState.simulationResults,
      });

      set(branchStateAtom, updatedBranchStates);
    }, []),
  );

  return { initializeBranch };
};
