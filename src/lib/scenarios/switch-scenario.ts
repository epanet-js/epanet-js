import type { Worktree } from "src/state/scenarios";
import type { ScenarioContext, ScenarioOperationResult } from "./types";

export const switchToScenario = (
  worktree: Worktree,
  scenarioId: string,
  context: ScenarioContext,
): ScenarioOperationResult => {
  if (worktree.activeScenarioId === scenarioId) {
    return {
      state: worktree,
      applyTarget: null,
      simulation: context.currentSimulation,
    };
  }

  const scenario = worktree.scenarios.get(scenarioId);
  if (!scenario) {
    throw new Error(`Scenario ${scenarioId} not found`);
  }

  const isMainActive = worktree.activeScenarioId === null;
  const updatedScenarios = new Map(worktree.scenarios);
  const newState = { ...worktree, scenarios: updatedScenarios };

  if (isMainActive) {
    newState.mainMomentLog = context.currentMomentLog;
    newState.mainSimulation = context.currentSimulation;
    newState.mainModelVersion = context.currentModelVersion;
  } else {
    const currentScenario = worktree.scenarios.get(worktree.activeScenarioId!);
    if (currentScenario) {
      updatedScenarios.set(worktree.activeScenarioId!, {
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
      baseSnapshot: worktree.baseModelSnapshot,
      momentLog: scenario.momentLog,
      modelVersion: scenario.modelVersion,
    },
    simulation: scenario.simulation,
  };
};

export const switchToMain = (
  worktree: Worktree,
  context: ScenarioContext,
): ScenarioOperationResult => {
  if (worktree.activeScenarioId === null) {
    return {
      state: worktree,
      applyTarget: null,
      simulation: context.currentSimulation,
    };
  }

  const lastActiveScenarioId = worktree.activeScenarioId;
  const updatedScenarios = new Map(worktree.scenarios);

  const currentScenario = worktree.scenarios.get(worktree.activeScenarioId);
  if (currentScenario) {
    updatedScenarios.set(worktree.activeScenarioId, {
      ...currentScenario,
      momentLog: context.currentMomentLog,
      simulation: context.currentSimulation,
      modelVersion: context.currentModelVersion,
    });
  }

  return {
    state: {
      ...worktree,
      scenarios: updatedScenarios,
      activeScenarioId: null,
      lastActiveScenarioId,
    },
    applyTarget: {
      baseSnapshot: worktree.baseModelSnapshot,
      momentLog: worktree.mainMomentLog,
      modelVersion: worktree.mainModelVersion,
    },
    simulation: worktree.mainSimulation,
  };
};
