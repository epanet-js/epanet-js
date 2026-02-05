import type { Worktree } from "./types";
import { getBranch } from "./helpers";

export const renameScenario = (
  worktree: Worktree,
  scenarioId: string,
  newName: string,
): Worktree => {
  const branch = getBranch(worktree, scenarioId);
  if (!branch) return worktree;

  const updatedBranches = new Map(worktree.branches);
  updatedBranches.set(scenarioId, { ...branch, name: newName });

  return { ...worktree, branches: updatedBranches };
};
