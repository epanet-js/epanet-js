import {
  initialScenariosState,
  type ScenariosState,
} from "src/state/scenarios";
import type { ScenarioOperationResult } from "./types";

export const deleteScenario = (
  scenariosState: ScenariosState,
  scenarioId: string,
): ScenarioOperationResult => {
  const scenarioToDelete = scenariosState.scenarios.get(scenarioId);
  if (!scenarioToDelete) {
    return { state: scenariosState, applyTarget: null, simulation: null };
  }

  const remainingScenarios = Array.from(scenariosState.scenarios.values())
    .filter((s) => s.id !== scenarioId)
    .sort((a, b) => a.createdAt - b.createdAt);

  const isDeletedActive = scenariosState.activeScenarioId === scenarioId;

  if (remainingScenarios.length === 0) {
    return {
      state: initialScenariosState,
      applyTarget: scenariosState.mainMomentLog
        ? {
            baseSnapshot: scenariosState.baseModelSnapshot!,
            momentLog: scenariosState.mainMomentLog,
            modelVersion: scenariosState.mainModelVersion!,
          }
        : null,
      simulation: scenariosState.mainSimulation,
    };
  }

  if (isDeletedActive) {
    const nextScenario = remainingScenarios[0];
    const updatedScenarios = new Map(scenariosState.scenarios);
    updatedScenarios.delete(scenarioId);

    return {
      state: {
        ...scenariosState,
        scenarios: updatedScenarios,
        activeScenarioId: nextScenario.id,
        lastActiveScenarioId: nextScenario.id,
      },
      applyTarget: {
        baseSnapshot: scenariosState.baseModelSnapshot!,
        momentLog: nextScenario.momentLog,
        modelVersion: nextScenario.modelVersion,
      },
      simulation: nextScenario.simulation,
    };
  }

  const updatedScenarios = new Map(scenariosState.scenarios);
  updatedScenarios.delete(scenarioId);

  return {
    state: {
      ...scenariosState,
      scenarios: updatedScenarios,
      lastActiveScenarioId:
        scenariosState.lastActiveScenarioId === scenarioId
          ? null
          : scenariosState.lastActiveScenarioId,
    },
    applyTarget: null,
    simulation: null,
  };
};
