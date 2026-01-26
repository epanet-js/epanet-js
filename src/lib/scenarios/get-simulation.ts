import type { Worktree } from "src/state/scenarios";
import type { SimulationState } from "src/state/jotai";

export const getSimulationForState = (
  state: Worktree,
  initialSimulationState: SimulationState,
): SimulationState => {
  if (state.activeScenarioId === null) {
    return state.mainRevision.simulation ?? initialSimulationState;
  }
  const scenario = state.scenarios.get(state.activeScenarioId);
  return scenario?.simulation ?? initialSimulationState;
};
