import type { ScenariosState } from "src/state/scenarios";
import type { ScenarioContext, ScenarioOperationResult } from "./types";

export const switchToScenario = (
  scenariosState: ScenariosState,
  scenarioId: string,
  context: ScenarioContext,
): ScenarioOperationResult => {
  if (scenariosState.activeScenarioId === scenarioId) {
    return {
      state: scenariosState,
      applyTarget: null,
      simulation: context.currentSimulation,
    };
  }

  const scenario = scenariosState.scenarios.get(scenarioId);
  if (!scenario) {
    throw new Error(`Scenario ${scenarioId} not found`);
  }

  const isMainActive = scenariosState.activeScenarioId === null;
  const updatedScenarios = new Map(scenariosState.scenarios);
  const newState = { ...scenariosState, scenarios: updatedScenarios };

  if (isMainActive) {
    newState.mainMomentLog = context.currentMomentLog;
    newState.mainSimulation = context.currentSimulation;
    newState.mainModelVersion = context.currentModelVersion;
  } else {
    const currentScenario = scenariosState.scenarios.get(
      scenariosState.activeScenarioId!,
    );
    if (currentScenario) {
      updatedScenarios.set(scenariosState.activeScenarioId!, {
        ...currentScenario,
        momentLog: context.currentMomentLog,
        simulation: context.currentSimulation,
        modelVersion: context.currentModelVersion,
      });
    }
  }

  return {
    state: {
      ...newState,
      activeScenarioId: scenarioId,
      lastActiveScenarioId: scenarioId,
    },
    applyTarget: {
      baseSnapshot: scenariosState.baseModelSnapshot!,
      momentLog: scenario.momentLog,
      modelVersion: scenario.modelVersion,
    },
    simulation: scenario.simulation,
  };
};

export const switchToMain = (
  scenariosState: ScenariosState,
  context: ScenarioContext,
): ScenarioOperationResult => {
  if (scenariosState.activeScenarioId === null) {
    return {
      state: scenariosState,
      applyTarget: null,
      simulation: context.currentSimulation,
    };
  }

  const lastActiveScenarioId = scenariosState.activeScenarioId;
  const updatedScenarios = new Map(scenariosState.scenarios);

  const currentScenario = scenariosState.scenarios.get(
    scenariosState.activeScenarioId,
  );
  if (currentScenario) {
    updatedScenarios.set(scenariosState.activeScenarioId, {
      ...currentScenario,
      momentLog: context.currentMomentLog,
      simulation: context.currentSimulation,
      modelVersion: context.currentModelVersion,
    });
  }

  return {
    state: {
      ...scenariosState,
      scenarios: updatedScenarios,
      activeScenarioId: null,
      lastActiveScenarioId,
    },
    applyTarget: scenariosState.mainMomentLog
      ? {
          baseSnapshot: scenariosState.baseModelSnapshot!,
          momentLog: scenariosState.mainMomentLog,
          modelVersion: scenariosState.mainModelVersion!,
        }
      : null,
    simulation: scenariosState.mainSimulation,
  };
};
