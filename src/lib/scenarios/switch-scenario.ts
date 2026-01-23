import type { ScenariosState } from "src/state/scenarios";
import type { ScenarioContext, ScenarioOperationResult } from "./types";

export const switchToScenario = (
  currentState: ScenariosState,
  scenarioId: string,
  context: ScenarioContext,
): ScenarioOperationResult => {
  if (currentState.activeScenarioId === scenarioId) {
    return {
      state: currentState,
      applyTarget: null,
      simulation: context.currentSimulation,
    };
  }

  const scenario = currentState.scenarios.get(scenarioId);
  if (!scenario) {
    throw new Error(`Scenario ${scenarioId} not found`);
  }

  const isMainActive = currentState.activeScenarioId === null;
  const updatedScenarios = new Map(currentState.scenarios);
  const newState = { ...currentState, scenarios: updatedScenarios };

  if (isMainActive) {
    newState.mainMomentLog = context.currentMomentLog;
    newState.mainSimulation = context.currentSimulation;
    newState.mainModelVersion = context.currentModelVersion;
  } else {
    const currentScenario = currentState.scenarios.get(
      currentState.activeScenarioId!,
    );
    if (currentScenario) {
      updatedScenarios.set(currentState.activeScenarioId!, {
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
      baseSnapshot: currentState.baseModelSnapshot!,
      momentLog: scenario.momentLog,
      modelVersion: scenario.modelVersion,
    },
    simulation: scenario.simulation,
  };
};

export const switchToMain = (
  currentState: ScenariosState,
  context: ScenarioContext,
): ScenarioOperationResult => {
  if (currentState.activeScenarioId === null) {
    return {
      state: currentState,
      applyTarget: null,
      simulation: context.currentSimulation,
    };
  }

  const lastActiveScenarioId = currentState.activeScenarioId;
  const updatedScenarios = new Map(currentState.scenarios);

  const currentScenario = currentState.scenarios.get(
    currentState.activeScenarioId,
  );
  if (currentScenario) {
    updatedScenarios.set(currentState.activeScenarioId, {
      ...currentScenario,
      momentLog: context.currentMomentLog,
      simulation: context.currentSimulation,
      modelVersion: context.currentModelVersion,
    });
  }

  return {
    state: {
      ...currentState,
      scenarios: updatedScenarios,
      activeScenarioId: null,
      lastActiveScenarioId,
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
};
