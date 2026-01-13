import { atom } from "jotai";
import { nanoid } from "nanoid";

export interface Scenario {
  id: string;
  name: string;
  number: number;
  createdAt: number;
}

export interface ScenariosState {
  activeScenarioId: string | null;
  scenarios: Map<string, Scenario>;
  highestScenarioNumber: number;
}

export const initialScenariosState: ScenariosState = {
  activeScenarioId: null,
  scenarios: new Map(),
  highestScenarioNumber: 0,
};

export const scenariosAtom = atom<ScenariosState>(initialScenariosState);

export const scenariosListAtom = atom((get) => {
  const state = get(scenariosAtom);
  return Array.from(state.scenarios.values()).sort(
    (a, b) => a.createdAt - b.createdAt,
  );
});

export const createScenario = (state: ScenariosState): Scenario => {
  const newNumber = state.highestScenarioNumber + 1;
  return {
    id: nanoid(),
    name: `Scenario #${newNumber}`,
    number: newNumber,
    createdAt: Date.now(),
  };
};
