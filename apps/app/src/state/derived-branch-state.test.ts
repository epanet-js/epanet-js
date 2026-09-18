import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import { LabelManager } from "@epanet-js/hydraulic-model";
import { ChangeSet } from "@epanet-js/change-set";
import { SessionHistory } from "src/lib/persistence/session-history";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { branchStateAtom, type BranchState } from "src/state/branch-state";
import {
  canRedoDerivedAtom,
  canUndoDerivedAtom,
  emptyHydraulicModel,
} from "src/state/derived-branch-state";

describe("canUndo/canRedo derived atoms", () => {
  it("are both false when the history is empty", () => {
    const store = setInitialStore({});

    expect(store.get(canUndoDerivedAtom)).toBe(false);
    expect(store.get(canRedoDerivedAtom)).toBe(false);
  });

  it("canUndo becomes true after a change set is appended", () => {
    const sessionHistory = new SessionHistory();
    sessionHistory.append(ChangeSet.of("fwd", []));
    const store = setInitialStore({ sessionHistory });

    expect(store.get(canUndoDerivedAtom)).toBe(true);
    expect(store.get(canRedoDerivedAtom)).toBe(false);
  });

  it("canRedo becomes true after undoing a change set", () => {
    const sessionHistory = new SessionHistory();
    sessionHistory.append(ChangeSet.of("fwd", []));
    sessionHistory.undo();
    const store = setInitialStore({ sessionHistory });

    expect(store.get(canUndoDerivedAtom)).toBe(false);
    expect(store.get(canRedoDerivedAtom)).toBe(true);
  });

  const setInitialStore = ({
    sessionHistory = new SessionHistory(),
  }: {
    sessionHistory?: SessionHistory;
  }) => {
    const store = createStore();
    const hydraulicModel = emptyHydraulicModel();
    const branchState: BranchState = {
      version: hydraulicModel.version,
      hydraulicModel,
      labelManager: new LabelManager(),
      sessionHistory,
      simulation: null,
      simulationSourceId: "main",
      simulationSettings: defaultSimulationSettings,
    };
    store.set(branchStateAtom, new Map([["main", branchState]]));
    return store;
  };
});
