import type { Worktree, BranchOperationResult } from "./types";
import { getBranch } from "./helpers";

export const switchToBranch = (
  worktree: Worktree,
  targetBranchId: string,
): BranchOperationResult => {
  if (worktree.activeBranchId === targetBranchId) {
    return { worktree, branch: null };
  }

  const targetBranch = getBranch(worktree, targetBranchId);
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
): BranchOperationResult => {
  return switchToBranch(worktree, scenarioId);
};

export const switchToMain = (worktree: Worktree): BranchOperationResult => {
  return switchToBranch(worktree, "main");
};
