import { atom } from "jotai";
import { MomentLog } from "src/lib/persistence/moment-log";
import type { Moment } from "src/lib/persistence/moment";
import { initialSimulationState } from "src/state/jotai";
import type { Snapshot } from "src/lib/scenarios/types";

export interface BaseModelSnapshot {
  moment: Moment;
  stateId: string;
}

export interface Worktree {
  activeScenarioId: string | null;
  lastActiveScenarioId: string | null;
  scenarios: Map<string, Snapshot>;
  mainRevision: Snapshot;
  highestScenarioNumber: number;
}

const emptySnapshot: BaseModelSnapshot = {
  moment: { note: "", putAssets: [], deleteAssets: [] },
  stateId: "",
};

const emptyMainRevision: Snapshot = {
  id: "main",
  name: "Main",
  base: emptySnapshot,
  version: "",
  momentLog: new MomentLog(),
  simulation: initialSimulationState,
  status: "open",
};

export const initialWorktree: Worktree = {
  activeScenarioId: null,
  lastActiveScenarioId: null,
  scenarios: new Map(),
  highestScenarioNumber: 0,
  mainRevision: emptyMainRevision,
};

export const worktreeAtom = atom<Worktree>(initialWorktree);

export const scenariosListAtom = atom((get) => {
  const state = get(worktreeAtom);
  return Array.from(state.scenarios.values());
});

export type { Snapshot } from "src/lib/scenarios/types";
