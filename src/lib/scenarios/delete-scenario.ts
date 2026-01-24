import { initialWorktree, type Worktree } from "src/state/scenarios";
import type { ScenarioOperationResult } from "./types";

export const deleteScenario = (
  worktree: Worktree,
  scenarioId: string,
): ScenarioOperationResult => {
  const scenarioToDelete = worktree.scenarios.get(scenarioId);
  if (!scenarioToDelete) {
    return { state: worktree, applyTarget: null, simulation: null };
  }

  const remainingScenarios = Array.from(worktree.scenarios.values())
    .filter((s) => s.id !== scenarioId)
    .sort((a, b) => a.createdAt - b.createdAt);

  const isDeletedActive = worktree.activeScenarioId === scenarioId;

  if (remainingScenarios.length === 0) {
    return {
      state: initialWorktree,
      applyTarget: {
        baseSnapshot: worktree.baseModelSnapshot,
        momentLog: worktree.mainMomentLog,
        modelVersion: worktree.mainModelVersion,
      },
      simulation: worktree.mainSimulation,
    };
  }

  if (isDeletedActive) {
    const nextScenario = remainingScenarios[0];
    const updatedScenarios = new Map(worktree.scenarios);
    updatedScenarios.delete(scenarioId);

    return {
      state: {
        ...worktree,
        scenarios: updatedScenarios,
        activeScenarioId: nextScenario.id,
        lastActiveScenarioId: nextScenario.id,
      },
      applyTarget: {
        baseSnapshot: worktree.baseModelSnapshot,
        momentLog: nextScenario.momentLog,
        modelVersion: nextScenario.modelVersion,
      },
      simulation: nextScenario.simulation,
    };
  }

  const updatedScenarios = new Map(worktree.scenarios);
  updatedScenarios.delete(scenarioId);

  return {
    state: {
      ...worktree,
      scenarios: updatedScenarios,
      lastActiveScenarioId:
        worktree.lastActiveScenarioId === scenarioId
          ? null
          : worktree.lastActiveScenarioId,
    },
    applyTarget: null,
    simulation: null,
  };
};
