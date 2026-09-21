import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import { nanoid } from "nanoid";
import { copyModel } from "src/hydraulic-model";
import { applyChangeSet } from "src/hydraulic-model/change-sets";
import { SessionHistory } from "src/lib/persistence/session-history";
import { settleAppliedModel } from "src/lib/persistence/transaction-helpers";
import { branchStateAtom, type BranchState } from "src/state/branch-state";
import { modelFactoriesAtom } from "src/state/model-factories";
import { worktreeAtom } from "src/state/scenarios";
import type { Branch, StoredBranches } from "@epanet-js/worktree";

const getMainState = (get: Getter): BranchState => {
  const worktree = get(worktreeAtom);
  const mainState = get(branchStateAtom).get(worktree.mainId);
  if (!mainState) {
    throw new Error("Main branch state not found");
  }
  return mainState;
};

const branchFromMain = (get: Getter, mainState: BranchState): BranchState => {
  const currentFactories = get(modelFactoriesAtom);
  const labelManager = mainState.labelManager.copy(
    new Map(currentFactories.labelCounters),
  );

  return {
    version: mainState.version,
    hydraulicModel: copyModel(mainState.hydraulicModel),
    labelManager,
    sessionHistory: new SessionHistory(mainState.hydraulicModel.version),
    simulation: mainState.simulation,
    simulationSourceId: mainState.simulationSourceId,
    simulationSettings: mainState.simulationSettings,
  };
};

export const seedStoredBranches = (
  get: Getter,
  set: Setter,
  { worktree, deltas }: StoredBranches,
): void => {
  const mainState = getMainState(get);
  const updatedBranchStates = new Map(get(branchStateAtom));

  for (const [branchId, delta] of deltas) {
    const state = branchFromMain(get, mainState);
    if (!delta.isEmpty) {
      const report = applyChangeSet(
        state.hydraulicModel,
        delta,
        "forward",
        state.labelManager,
      );
      const version = nanoid();
      state.hydraulicModel = settleAppliedModel(
        state.hydraulicModel,
        version,
        report,
      );
      state.version = version;
      state.sessionHistory = new SessionHistory(version);
    }
    updatedBranchStates.set(branchId, state);
  }

  set(branchStateAtom, updatedBranchStates);
  set(worktreeAtom, worktree);
};

export const useInitializeBranch = () => {
  const initializeBranch = useAtomCallback(
    useCallback((get: Getter, set: Setter, branch: Branch) => {
      const mainState = getMainState(get);

      const updatedBranchStates = new Map(get(branchStateAtom));
      updatedBranchStates.set(branch.id, branchFromMain(get, mainState));

      set(branchStateAtom, updatedBranchStates);
    }, []),
  );

  return { initializeBranch };
};
