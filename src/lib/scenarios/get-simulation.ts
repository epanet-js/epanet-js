import type { ScenariosState } from "src/state/scenarios";
import type { SimulationState } from "src/state/jotai";

export const getSimulationForState = (
  state: ScenariosState,
  initialSimulationState: SimulationState,
): SimulationState => {
  if (state.activeScenarioId === null) {
    return state.mainSimulation ?? initialSimulationState;
  }
  const scenario = state.scenarios.get(state.activeScenarioId);
  return scenario?.simulation ?? initialSimulationState;
};
