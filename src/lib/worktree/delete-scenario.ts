import type { Worktree, BranchOperationResult } from "./types";
import { getBranch, isMainBranch, getScenarios } from "./helpers";

export const deleteScenario = (
  worktree: Worktree,
  scenarioId: string,
): BranchOperationResult => {
  // Can't delete main
  if (isMainBranch(scenarioId)) {
    return { worktree, branch: null };
  }

  const branchToDelete = getBranch(worktree, scenarioId);
  if (!branchToDelete) {
    return { worktree, branch: null };
  }

  const updatedBranches = new Map(worktree.branches);
  updatedBranches.delete(scenarioId);

  // Also delete associated versions
  // For now, delete the branch's head version
  // In the future, might need to handle version chains
  const updatedVersions = new Map(worktree.versions);
  updatedVersions.delete(branchToDelete.headRevisionId);

  const remainingScenarios = getScenarios({
    ...worktree,
    branches: updatedBranches,
  });
  const isDeletedActive = worktree.activeBranchId === scenarioId;
  const isLastScenario = remainingScenarios.length === 0;

  // If deleted the active branch, switch to another
  if (isDeletedActive) {
    const nextBranchId = isLastScenario
      ? "main"
      : (remainingScenarios[0]?.id ?? "main");
    const nextBranch = updatedBranches.get(nextBranchId) ?? null;

    return {
      worktree: {
        ...worktree,
        branches: updatedBranches,
        versions: updatedVersions,
        activeBranchId: nextBranchId,
        lastActiveBranchId: nextBranchId,
        highestScenarioNumber: isLastScenario
          ? 0
          : worktree.highestScenarioNumber,
      },
      branch: nextBranch,
    };
  }

  return {
    worktree: {
      ...worktree,
      branches: updatedBranches,
      versions: updatedVersions,
      lastActiveBranchId:
        worktree.lastActiveBranchId === scenarioId
          ? "main"
          : worktree.lastActiveBranchId,
      highestScenarioNumber: isLastScenario
        ? 0
        : worktree.highestScenarioNumber,
    },
    branch: null,
  };
};
