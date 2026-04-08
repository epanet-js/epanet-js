import { atom } from "jotai";
import { MomentLog } from "src/lib/persistence/moment-log";
import { initialSimulationState } from "src/state/simulation";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import type { Worktree, Snapshot, Branch } from "src/lib/worktree/types";

const emptyMainSnapshot: Snapshot = {
  id: "main",
  name: "Main",
  parentId: null,
  deltas: [],
  version: "",
  momentLog: new MomentLog(),
  simulation: initialSimulationState,
  simulationSourceId: "main",
  simulationSettings: defaultSimulationSettings,
  status: "open",
};

export const initialWorktree: Worktree = {
  activeSnapshotId: "main",
  lastActiveSnapshotId: "main",
  snapshots: new Map([["main", emptyMainSnapshot]]),
  branches: new Map(),
  mainId: "main",
  scenarios: [],
  highestScenarioNumber: 0,
};

export const worktreeAtom = atom<Worktree>(initialWorktree);

export const scenariosListAtom = atom((get) => {
  const state = get(worktreeAtom);
  return state.scenarios
    .map((id) => state.branches.get(id) ?? state.snapshots.get(id))
    .filter((s): s is Branch | Snapshot => s !== undefined);
});

export const hasScenariosAtom = atom((get) => {
  return get(worktreeAtom).scenarios.length > 0;
});

export type { Worktree, Snapshot } from "src/lib/worktree/types";
