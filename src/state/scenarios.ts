import { atom } from "jotai";
import { nanoid } from "nanoid";
import { MomentLog } from "src/lib/persistence/moment-log";
import { Moment } from "src/lib/persistence/moment";
import type { SimulationState } from "src/state/jotai";

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

export interface ScenariosState {
  activeScenarioId: string | null;
  lastActiveScenarioId: string | null;
  scenarios: Map<string, Scenario>;
  highestScenarioNumber: number;
  baseModelSnapshot: BaseModelSnapshot | null;
  mainMomentLog: MomentLog | null;
  mainSimulation: SimulationState | null;
  mainModelVersion: string | null;
}

export const initialScenariosState: ScenariosState = {
  activeScenarioId: null,
  lastActiveScenarioId: null,
  scenarios: new Map(),
  highestScenarioNumber: 0,
  baseModelSnapshot: null,
  mainMomentLog: null,
  mainSimulation: null,
  mainModelVersion: null,
};

export const scenariosAtom = atom<ScenariosState>(initialScenariosState);

export const scenariosListAtom = atom((get) => {
  const state = get(scenariosAtom);
  return Array.from(state.scenarios.values()).sort(
    (a, b) => a.createdAt - b.createdAt,
  );
});

export const createScenario = (
  state: ScenariosState,
  momentLog: MomentLog,
  modelVersion: string,
): Scenario => {
  const newNumber = state.highestScenarioNumber + 1;
  return {
    id: nanoid(),
    name: `Scenario #${newNumber}`,
    number: newNumber,
    createdAt: Date.now(),
    momentLog,
    simulation: null,
    modelVersion,
  };
};
