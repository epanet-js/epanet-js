import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import { nanoid } from "nanoid";
import type { ModelFactories } from "@epanet-js/hydraulic-model";
import type { ChangeSet } from "@epanet-js/change-set";
import { observeIdentifiers } from "src/lib/persistence/observe-identifiers";
import { copyModel } from "src/hydraulic-model";
import { applyChangeSet } from "@epanet-js/hydraulic-model-operations";
import { buildSimulationSettingsData } from "src/lib/db";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { SessionHistory } from "src/lib/persistence/session-history";
import { settleAppliedModel } from "src/lib/persistence/transaction-helpers";
import {
  branchStateAtom,
  isBranchLoaded,
  type BranchState,
  type UnloadedBranchState,
} from "src/state/branch-state";
import { modelFactoriesAtom } from "src/state/model-factories";
import { worktreeAtom } from "src/state/scenarios";
import { nullTrace, type Trace } from "src/infra/trace";
import type {
  Branch,
  StoredBranch,
  StoredBranches,
  Worktree,
} from "@epanet-js/worktree";

export const getMainState = (get: Getter): BranchState => {
  const worktree = get(worktreeAtom);
  const mainState = get(branchStateAtom).get(worktree.mainId);
  if (!mainState || !isBranchLoaded(mainState)) {
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

export const buildUnloadedBranchStates = async (
  mainState: BranchState,
  factories: ModelFactories,
  { worktree }: StoredBranches,
  loadBranch: (branchId: string) => Promise<StoredBranch>,
  trace: Trace,
): Promise<Map<string, UnloadedBranchState>> => {
  const branchStates = new Map<string, UnloadedBranchState>();

  for (const branchId of worktree.scenarios) {
    const { delta, simulationSettings } = await trace.measureAsync(
      `${branchId}:read-branch`,
      () => loadBranch(branchId),
    );
    let version = mainState.version;
    if (delta.size > 0) {
      trace.measure(
        `${branchId}:observe-identifiers`,
        () => observeIdentifiers(factories, delta),
        `${delta.size} records, ${delta.byteLength} bytes`,
      );
      version = nanoid();
    }

    branchStates.set(branchId, {
      version,
      sessionHistory: new SessionHistory(version),
      simulation: mainState.simulation,
      simulationSourceId: mainState.simulationSourceId,
      simulationSettings:
        simulationSettings !== null
          ? buildSimulationSettingsData(
              simulationSettings,
              defaultSimulationSettings,
            )
          : mainState.simulationSettings,
    });
  }

  return branchStates;
};

export const materializeBranch = (
  mainState: BranchState,
  factories: ModelFactories,
  unloaded: UnloadedBranchState,
  delta: ChangeSet,
  trace: Trace = nullTrace,
): BranchState => {
  const state: BranchState = {
    ...trace.measure("copy-main", () => branchFromMain(mainState, factories)),
    ...unloaded,
  };
  const detail = `${delta.size} records, ${delta.byteLength} bytes`;
  const report = trace.measure(
    "apply-delta",
    () =>
      applyChangeSet(
        state.hydraulicModel,
        delta,
        "forward",
        state.labelManager,
      ),
    detail,
  );
  state.hydraulicModel = trace.measure("settle-model", () =>
    settleAppliedModel(state.hydraulicModel, unloaded.version, report),
  );
  return state;
};

export const unloadBranch = ({
  version,
  sessionHistory,
  simulation,
  simulationSourceId,
  simulationSettings,
}: BranchState | UnloadedBranchState): UnloadedBranchState => ({
  version,
  sessionHistory,
  simulation,
  simulationSourceId,
  simulationSettings,
});

export const commitStoredBranches = (
  set: Setter,
  worktree: Worktree,
  branchStates: Map<string, BranchState | UnloadedBranchState>,
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
