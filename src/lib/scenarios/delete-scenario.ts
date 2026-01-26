import { initialWorktree, type Worktree } from "src/state/scenarios";
import type { ScenarioOperationResult } from "./types";

export const deleteScenario = (
  worktree: Worktree,
  scenarioId: string,
): ScenarioOperationResult => {
  const scenarioToDelete = worktree.scenarios.get(scenarioId);
  if (!scenarioToDelete) {
    return { worktree, snapshot: null };
  }

  const remainingScenarios = Array.from(worktree.scenarios.values()).filter(
    (s) => s.id !== scenarioId,
  );

  const isDeletedActive = worktree.activeScenarioId === scenarioId;

  if (remainingScenarios.length === 0) {
    return {
      worktree: initialWorktree,
      snapshot: worktree.mainRevision,
    };
  }

  if (isDeletedActive) {
    const nextScenario = remainingScenarios[0];
    const updatedScenarios = new Map(worktree.scenarios);
    updatedScenarios.delete(scenarioId);

    return {
      worktree: {
        ...worktree,
        scenarios: updatedScenarios,
        activeScenarioId: nextScenario.id,
        lastActiveScenarioId: nextScenario.id,
      },
      snapshot: nextScenario,
    };
  }

  const updatedScenarios = new Map(worktree.scenarios);
  updatedScenarios.delete(scenarioId);

  return {
    worktree: {
      ...worktree,
      scenarios: updatedScenarios,
      lastActiveScenarioId:
        worktree.lastActiveScenarioId === scenarioId
          ? null
          : worktree.lastActiveScenarioId,
    },
    snapshot: null,
  };
};
