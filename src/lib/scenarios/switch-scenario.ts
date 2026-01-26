import type { Worktree } from "src/state/scenarios";
import type { ScenarioContext, ScenarioOperationResult } from "./types";

export const switchToScenario = (
  worktree: Worktree,
  scenarioId: string,
  context: ScenarioContext,
): ScenarioOperationResult => {
  if (worktree.activeScenarioId === scenarioId) {
    return { worktree, snapshot: null };
  }

  const scenario = worktree.scenarios.get(scenarioId);
  if (!scenario) {
    throw new Error(`Scenario ${scenarioId} not found`);
  }

  const isMainActive = worktree.activeScenarioId === null;
  const updatedScenarios = new Map(worktree.scenarios);
  let newState = { ...worktree, scenarios: updatedScenarios };

  if (isMainActive) {
    newState = {
      ...newState,
      mainRevision: {
        ...worktree.mainRevision,
        momentLog: context.currentMomentLog,
        simulation: context.currentSimulation,
        version: context.currentModelVersion,
      },
    };
  } else {
    const currentScenario = worktree.scenarios.get(worktree.activeScenarioId!);
    if (currentScenario) {
      updatedScenarios.set(worktree.activeScenarioId!, {
        ...currentScenario,
        momentLog: context.currentMomentLog,
        simulation: context.currentSimulation,
        version: context.currentModelVersion,
      });
    }
  }

  return {
    worktree: {
      ...newState,
      activeScenarioId: scenarioId,
      lastActiveScenarioId: scenarioId,
    },
    snapshot: scenario,
  };
};

export const switchToMain = (
  worktree: Worktree,
  context: ScenarioContext,
): ScenarioOperationResult => {
  if (worktree.activeScenarioId === null) {
    return { worktree, snapshot: null };
  }

  const lastActiveScenarioId = worktree.activeScenarioId;
  const updatedScenarios = new Map(worktree.scenarios);

  const currentScenario = worktree.scenarios.get(worktree.activeScenarioId);
  if (currentScenario) {
    updatedScenarios.set(worktree.activeScenarioId, {
      ...currentScenario,
      momentLog: context.currentMomentLog,
      simulation: context.currentSimulation,
      version: context.currentModelVersion,
    });
  }

  return {
    worktree: {
      ...worktree,
      scenarios: updatedScenarios,
      activeScenarioId: null,
      lastActiveScenarioId,
    },
    snapshot: worktree.mainRevision,
  };
};
