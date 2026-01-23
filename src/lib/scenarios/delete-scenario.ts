import type { ScenariosState } from "src/state/scenarios";
import type { ScenarioOperationResult } from "./types";

export const deleteScenario = (
  currentState: ScenariosState,
  scenarioId: string,
): ScenarioOperationResult => {
  const scenarioToDelete = currentState.scenarios.get(scenarioId);
  if (!scenarioToDelete) {
    return { state: currentState, applyTarget: null, simulation: null };
  }

  const remainingScenarios = Array.from(currentState.scenarios.values())
    .filter((s) => s.id !== scenarioId)
    .sort((a, b) => a.createdAt - b.createdAt);

  const isDeletedActive = currentState.activeScenarioId === scenarioId;

  if (remainingScenarios.length === 0) {
    return {
      state: {
        ...currentState,
        scenarios: new Map(),
        activeScenarioId: null,
        baseModelSnapshot: null,
        mainMomentLog: null,
        mainSimulation: null,
        mainModelVersion: null,
        highestScenarioNumber: 0,
        lastActiveScenarioId: null,
      },
      applyTarget: currentState.mainMomentLog
        ? {
            baseSnapshot: currentState.baseModelSnapshot!,
            momentLog: currentState.mainMomentLog,
            modelVersion: currentState.mainModelVersion!,
          }
        : null,
      simulation: currentState.mainSimulation,
    };
  }

  if (isDeletedActive) {
    const nextScenario = remainingScenarios[0];
    const updatedScenarios = new Map(currentState.scenarios);
    updatedScenarios.delete(scenarioId);

    return {
      state: {
        ...currentState,
        scenarios: updatedScenarios,
        activeScenarioId: nextScenario.id,
        lastActiveScenarioId: nextScenario.id,
      },
      applyTarget: {
        baseSnapshot: currentState.baseModelSnapshot!,
        momentLog: nextScenario.momentLog,
        modelVersion: nextScenario.modelVersion,
      },
      simulation: nextScenario.simulation,
    };
  }

  const updatedScenarios = new Map(currentState.scenarios);
  updatedScenarios.delete(scenarioId);

  return {
    state: {
      ...currentState,
      scenarios: updatedScenarios,
      lastActiveScenarioId:
        currentState.lastActiveScenarioId === scenarioId
          ? null
          : currentState.lastActiveScenarioId,
    },
    applyTarget: null,
    simulation: null,
  };
};
