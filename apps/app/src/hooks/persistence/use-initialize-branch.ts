import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import { nanoid } from "nanoid";
import type { ModelFactories } from "@epanet-js/hydraulic-model";
import { copyModel } from "src/hydraulic-model";
import { applyChangeSet } from "src/hydraulic-model/change-sets";
import { SessionHistory } from "src/lib/persistence/session-history";
import { settleAppliedModel } from "src/lib/persistence/transaction-helpers";
import { observeIds } from "src/lib/id-pools";
import { branchStateAtom, type BranchState } from "src/state/branch-state";
import { modelFactoriesAtom } from "src/state/model-factories";
import { worktreeAtom } from "src/state/scenarios";
import type { Branch, StoredBranches, Worktree } from "@epanet-js/worktree";

const getMainState = (get: Getter): BranchState => {
  const worktree = get(worktreeAtom);
  const mainState = get(branchStateAtom).get(worktree.mainId);
  if (!mainState) {
    throw new Error("Main branch state not found");
  }
  return mainState;
};

const branchFromMain = (
  mainState: BranchState,
  factories: ModelFactories,
): BranchState => {
  const labelManager = mainState.labelManager.copy(
    new Map(factories.labelCounters),
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

export const buildStoredBranchStates = (
  mainState: BranchState,
  factories: ModelFactories,
  { deltas }: StoredBranches,
): Map<string, BranchState> => {
  const branchStates = new Map<string, BranchState>();

  for (const [branchId, delta] of deltas) {
    const state = branchFromMain(mainState, factories);
    if (!delta.isEmpty) {
      observeIds(factories.idPools, delta);
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
    branchStates.set(branchId, state);
  }

  return branchStates;
};

export const commitStoredBranches = (
  set: Setter,
  worktree: Worktree,
  branchStates: Map<string, BranchState>,
): void => {
  set(branchStateAtom, (previous) => new Map([...previous, ...branchStates]));
  set(worktreeAtom, worktree);
};

export const useInitializeBranch = () => {
  const initializeBranch = useAtomCallback(
    useCallback((get: Getter, set: Setter, branch: Branch) => {
      const updatedBranchStates = new Map(get(branchStateAtom));
      updatedBranchStates.set(
        branch.id,
        branchFromMain(getMainState(get), get(modelFactoriesAtom)),
      );

      set(branchStateAtom, updatedBranchStates);
    }, []),
  );

  return { initializeBranch };
};
