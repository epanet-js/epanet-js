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
import {
  applyChangeSet,
  applyChangeSetDeprecated,
} from "src/hydraulic-model/change-sets";
import { buildSimulationSettingsData } from "src/lib/db";
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
  StoredBranchesDeprecated,
  Worktree,
} from "@epanet-js/worktree";

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

const observeIdentifiersDeprecated = (
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

const observeIdentifiers = (
  factories: ModelFactories,
  changeSet: ChangeSet,
): void => {
  const counters = factories.labelCounters;

  for (const entry of changeSet.entries()) {
    const identifiers = identifiersByEntity[entry.entity];
    if (!identifiers) continue;
    const { pool, labelType } = identifiers;

    if (typeof entry.id === "number") {
      factories.idPools.forPool(pool).observe(entry.id);
    }

    const label = entry.get("after", "label");
    if (typeof label !== "string") continue;
    const index = LabelManager.generatedIndex(label, labelType);
    if (index !== null && index + 1 > (counters.get(labelType) ?? 0)) {
      counters.set(labelType, index + 1);
    }
  }
};

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

export const buildStoredBranchStates = (
  mainState: BranchState,
  factories: ModelFactories,
  { deltas, simulationSettings }: StoredBranchesDeprecated,
  trace: Trace,
): Map<string, BranchState> => {
  const branchStates = new Map<string, BranchState>();

  for (const [branchId, delta] of deltas) {
    const state = trace.measure(`${branchId}:copy-main`, () =>
      branchFromMain(mainState, factories),
    );
    const { records } = trace.measure(
      `${branchId}:decode-delta`,
      () => delta.read(),
      `${delta.byteLength} bytes`,
    );
    if (records.length > 0) {
      const detail = `${records.length} records`;
      trace.measure(
        `${branchId}:observe-identifiers`,
        () => observeIdentifiersDeprecated(factories, delta),
        detail,
      );
      const report = trace.measure(
        `${branchId}:apply-delta`,
        () =>
          applyChangeSetDeprecated(
            state.hydraulicModel,
            delta,
            "forward",
            state.labelManager,
          ),
        detail,
      );
      const version = nanoid();
      state.hydraulicModel = trace.measure(`${branchId}:settle-model`, () =>
        settleAppliedModel(state.hydraulicModel, version, report),
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
          ? buildSimulationSettingsData(simulationSettings)
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
