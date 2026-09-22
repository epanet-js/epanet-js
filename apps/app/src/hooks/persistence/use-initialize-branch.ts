import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import { nanoid } from "nanoid";
import {
  LabelManager,
  type LabelType,
  type ModelFactories,
} from "@epanet-js/hydraulic-model";
import type { ChangeSet, EntityKind } from "@epanet-js/change-set";
import type { IdPool } from "@epanet-js/id-generator";
import { copyModel } from "src/hydraulic-model";
import { applyChangeSet } from "src/hydraulic-model/change-sets";
import { buildSimulationSettingsData } from "src/lib/db";
import { SessionHistory } from "src/lib/persistence/session-history";
import { settleAppliedModel } from "src/lib/persistence/transaction-helpers";
import { branchStateAtom, type BranchState } from "src/state/branch-state";
import { modelFactoriesAtom } from "src/state/model-factories";
import { worktreeAtom } from "src/state/scenarios";
import type { Branch, StoredBranches, Worktree } from "@epanet-js/worktree";

type Identifiers = { pool: IdPool; labelType: LabelType };

const identifiersByEntity: Record<EntityKind, Identifiers | null> = {
  junction: { pool: "asset", labelType: "junction" },
  reservoir: { pool: "asset", labelType: "reservoir" },
  tank: { pool: "asset", labelType: "tank" },
  pipe: { pool: "asset", labelType: "pipe" },
  pump: { pool: "asset", labelType: "pump" },
  valve: { pool: "asset", labelType: "valve" },
  customerPoint: { pool: "customerPoint", labelType: "customerPoint" },
  pattern: { pool: "pattern", labelType: "pattern" },
  curve: { pool: "curve", labelType: "curve" },
  junctionDemand: null,
  customerDemand: null,
  allControls: null,
  customAttributesDefinition: null,
  pipeLibrary: null,
  rawControls: null,
};

const observeIdentifiers = (
  factories: ModelFactories,
  changeSet: ChangeSet,
): void => {
  const counters = factories.labelCounters;

  for (const record of changeSet.read().records) {
    const identifiers = identifiersByEntity[record.entity];
    if (!identifiers) continue;
    const { pool, labelType } = identifiers;

    if (typeof record.id === "number") {
      factories.idPools.forPool(pool).observe(record.id);
    }

    const label = record.after.label;
    if (typeof label !== "string") continue;
    const index = LabelManager.generatedIndex(label, labelType);
    if (index !== null && index + 1 > (counters.get(labelType) ?? 0)) {
      counters.set(labelType, index + 1);
    }
  }
};

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
  { deltas, simulationSettings }: StoredBranches,
): Map<string, BranchState> => {
  const branchStates = new Map<string, BranchState>();

  for (const [branchId, delta] of deltas) {
    const state = branchFromMain(mainState, factories);
    if (!delta.isEmpty) {
      observeIdentifiers(factories, delta);
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

    const storedSettings = simulationSettings.get(branchId);
    if (storedSettings !== undefined) {
      state.simulationSettings = buildSimulationSettingsData(storedSettings);
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
