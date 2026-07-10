import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import { LabelManager } from "@epanet-js/hydraulic-model";
import { MomentLog } from "src/lib/persistence/moment-log";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { branchStateAtom, type BranchState } from "src/state/branch-state";
import {
  canRedoDerivedAtom,
  canUndoDerivedAtom,
  nullHydraulicModel,
} from "src/state/derived-branch-state";

describe("canUndo/canRedo derived atoms", () => {
  it("are both false when the history is empty", () => {
    const store = setInitialStore(new MomentLog());

    expect(store.get(canUndoDerivedAtom)).toBe(false);
    expect(store.get(canRedoDerivedAtom)).toBe(false);
  });

  it("canUndo becomes true after an action is appended", () => {
    const momentLog = new MomentLog();
    momentLog.append({ note: "fwd" }, { note: "rev" });
    const store = setInitialStore(momentLog);

    expect(store.get(canUndoDerivedAtom)).toBe(true);
    expect(store.get(canRedoDerivedAtom)).toBe(false);
  });

  it("canRedo becomes true after undoing back to the boundary", () => {
    const momentLog = new MomentLog();
    momentLog.append({ note: "fwd" }, { note: "rev" });
    momentLog.undo();
    const store = setInitialStore(momentLog);

    expect(store.get(canUndoDerivedAtom)).toBe(false);
    expect(store.get(canRedoDerivedAtom)).toBe(true);
  });

  const setInitialStore = (momentLog: MomentLog) => {
    const store = createStore();
    const branchState: BranchState = {
      version: nullHydraulicModel.version,
      hydraulicModel: nullHydraulicModel,
      labelManager: new LabelManager(),
      momentLog,
      simulation: null,
      simulationSourceId: "main",
      simulationSettings: defaultSimulationSettings,
    };
    store.set(branchStateAtom, new Map([["main", branchState]]));
    return store;
  };
});
