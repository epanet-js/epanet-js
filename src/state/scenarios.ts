import { atom } from "jotai";
import { MomentLog } from "src/lib/persistence/moment-log";
import { initialSimulationState } from "src/state/jotai";
import type {
  BaseModelSnapshot,
  Worktree,
  Snapshot,
} from "src/lib/worktree/types";

const emptySnapshot: BaseModelSnapshot = {
  moment: { note: "", putAssets: [], deleteAssets: [] },
  stateId: "",
};

const emptyMainSnapshot: Snapshot = {
  id: "main",
  name: "Main",
  base: emptySnapshot,
  version: "",
  momentLog: new MomentLog(),
  simulation: initialSimulationState,
  status: "open",
};

export const initialWorktree: Worktree = {
  activeSnapshotId: "main",
  lastActiveSnapshotId: "main",
  snapshots: new Map([["main", emptyMainSnapshot]]),
  mainId: "main",
  scenarios: [],
  highestScenarioNumber: 0,
};

export const worktreeAtom = atom<Worktree>(initialWorktree);

export const scenariosListAtom = atom((get) => {
  const state = get(worktreeAtom);
  return state.scenarios
    .map((id) => state.snapshots.get(id))
    .filter((s): s is Snapshot => s !== undefined);
});

export type {
  BaseModelSnapshot,
  Worktree,
  Snapshot,
} from "src/lib/worktree/types";
