import type { Worktree, ScenarioOperationResult } from "./types";

export const deleteScenario = (
  worktree: Worktree,
  scenarioId: string,
): ScenarioOperationResult => {
  if (!worktree.scenarios.includes(scenarioId)) {
    return { worktree, branch: null };
  }

  const branchToDelete = worktree.branches.get(scenarioId);
  if (!branchToDelete) {
    return { worktree, branch: null };
  }

  const remainingScenarioIds = worktree.scenarios.filter(
    (id) => id !== scenarioId,
  );
  const isDeletedActive = worktree.activeBranchId === scenarioId;
  const isLastScenario = remainingScenarioIds.length === 0;

  const updatedBranches = new Map(worktree.branches);
  updatedBranches.delete(scenarioId);

  if (isLastScenario) {
    const mainBranch = updatedBranches.get(worktree.mainId);
    if (mainBranch) {
      updatedBranches.set(worktree.mainId, { ...mainBranch, status: "open" });
    }

    const unlockedMain = updatedBranches.get(worktree.mainId);

    return {
      worktree: {
        ...worktree,
        branches: updatedBranches,
        scenarios: [],
        activeBranchId: worktree.mainId,
        lastActiveBranchId: worktree.mainId,
        highestScenarioNumber: 0,
      },
      branch: unlockedMain ?? null,
    };
  }

  if (isDeletedActive) {
    const nextScenarioId = remainingScenarioIds[0];
    const nextBranch = updatedBranches.get(nextScenarioId);

    return {
      worktree: {
        ...worktree,
        branches: updatedBranches,
        scenarios: remainingScenarioIds,
        activeBranchId: nextScenarioId,
        lastActiveBranchId: nextScenarioId,
      },
      branch: nextBranch ?? null,
    };
  }

  return {
    worktree: {
      ...worktree,
      branches: updatedBranches,
      scenarios: remainingScenarioIds,
      lastActiveBranchId:
        worktree.lastActiveBranchId === scenarioId
          ? worktree.mainId
          : worktree.lastActiveBranchId,
    },
    branch: null,
  };
};
