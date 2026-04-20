import type { Worktree, ScenarioOperationResult } from "./types";

export const switchToBranch = (
  worktree: Worktree,
  targetBranchId: string,
): ScenarioOperationResult => {
  if (worktree.activeBranchId === targetBranchId) {
    return { worktree, branch: null };
  }

  const targetBranch = worktree.branches.get(targetBranchId);
  if (!targetBranch) {
    throw new Error(`Branch ${targetBranchId} not found`);
  }

  return {
    worktree: {
      ...worktree,
      activeBranchId: targetBranchId,
      lastActiveBranchId: worktree.activeBranchId,
    },
    branch: targetBranch,
  };
};

export const switchToScenario = (
  worktree: Worktree,
  scenarioId: string,
): ScenarioOperationResult => {
  return switchToBranch(worktree, scenarioId);
};

export const switchToMain = (worktree: Worktree): ScenarioOperationResult => {
  return switchToBranch(worktree, worktree.mainId);
};
