import type { ScenariosState } from "src/state/scenarios";

export const renameScenario = (
  currentState: ScenariosState,
  scenarioId: string,
  newName: string,
): ScenariosState => {
  const scenario = currentState.scenarios.get(scenarioId);
  if (!scenario) return currentState;

  const updatedScenarios = new Map(currentState.scenarios);
  updatedScenarios.set(scenarioId, { ...scenario, name: newName });

  return { ...currentState, scenarios: updatedScenarios };
};
