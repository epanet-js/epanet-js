import { atom } from "jotai";
import { MomentLog } from "src/lib/persistence/moment-log";
import type { Moment } from "src/lib/persistence/moment";
import { type SimulationState, initialSimulationState } from "src/state/jotai";

export interface Scenario {
  id: string;
  name: string;
  number: number;
  createdAt: number;
  momentLog: MomentLog;
  simulation: SimulationState | null;
  modelVersion: string;
}

export interface BaseModelSnapshot {
  moment: Moment;
  stateId: string;
}

export interface Worktree {
  activeScenarioId: string | null;
  lastActiveScenarioId: string | null;
  scenarios: Map<string, Scenario>;
  highestScenarioNumber: number;
  baseModelSnapshot: BaseModelSnapshot;
  mainMomentLog: MomentLog;
  mainSimulation: SimulationState;
  mainModelVersion: string;
}

const emptySnapshot: BaseModelSnapshot = {
  moment: { note: "", putAssets: [], deleteAssets: [] },
  stateId: "",
};

export const initialWorktree: Worktree = {
  activeScenarioId: null,
  lastActiveScenarioId: null,
  scenarios: new Map(),
  highestScenarioNumber: 0,
  baseModelSnapshot: emptySnapshot,
  mainMomentLog: new MomentLog(),
  mainSimulation: initialSimulationState,
  mainModelVersion: "",
};

export const worktreeAtom = atom<Worktree>(initialWorktree);

export const scenariosListAtom = atom((get) => {
  const state = get(worktreeAtom);
  return Array.from(state.scenarios.values()).sort(
    (a, b) => a.createdAt - b.createdAt,
  );
});
