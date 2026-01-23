import type { ScenariosState } from "src/state/scenarios";

export const renameScenario = (
  scenariosState: ScenariosState,
  scenarioId: string,
  newName: string,
): ScenariosState => {
  const scenario = scenariosState.scenarios.get(scenarioId);
  if (!scenario) return scenariosState;

  const updatedScenarios = new Map(scenariosState.scenarios);
  updatedScenarios.set(scenarioId, { ...scenario, name: newName });

  return { ...scenariosState, scenarios: updatedScenarios };
};
