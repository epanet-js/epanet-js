import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import { copyModel } from "src/hydraulic-model";
import { SessionHistory } from "src/lib/persistence/session-history";
import { branchStateAtom } from "src/state/branch-state";
import { modelFactoriesAtom } from "src/state/model-factories";
import { worktreeAtom } from "src/state/scenarios";
import type { Branch } from "@epanet-js/worktree";

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
      const labelManager = mainState.labelManager.copy(
        new Map(currentFactories.labelCounters),
      );

      const updatedBranchStates = new Map(branchStates);
      updatedBranchStates.set(branch.id, {
        version: mainState.version,
        hydraulicModel: copyModel(mainState.hydraulicModel),
        labelManager,
        sessionHistory: new SessionHistory(mainState.hydraulicModel.version),
        simulation: mainState.simulation,
        simulationSourceId: mainState.simulationSourceId,
        simulationSettings: mainState.simulationSettings,
      });

      set(branchStateAtom, updatedBranchStates);
    }, []),
  );

  return { initializeBranch };
};
