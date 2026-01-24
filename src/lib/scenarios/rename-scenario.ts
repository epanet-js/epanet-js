import type { Worktree } from "src/state/scenarios";

export const renameScenario = (
  worktree: Worktree,
  scenarioId: string,
  newName: string,
): Worktree => {
  const scenario = worktree.scenarios.get(scenarioId);
  if (!scenario) return worktree;

  const updatedScenarios = new Map(worktree.scenarios);
  updatedScenarios.set(scenarioId, { ...scenario, name: newName });

  return { ...worktree, scenarios: updatedScenarios };
};
