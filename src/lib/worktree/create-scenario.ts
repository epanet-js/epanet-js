import type { Branch, Worktree } from "./types";
import { nanoid } from "nanoid";

export const createScenario = (
  worktree: Worktree,
): { branch: Branch; worktree: Worktree } => {
  const newNumber = worktree.highestScenarioNumber + 1;

  const newBranch: Branch = {
    id: nanoid(),
    name: `Scenario #${newNumber}`,
    parentId: worktree.mainId,
    status: "open",
  };

  const updatedBranches = new Map(worktree.branches);
  updatedBranches.set(newBranch.id, newBranch);

  const isFirstScenario = worktree.scenarios.length === 0;
  if (isFirstScenario) {
    const mainBranch = updatedBranches.get(worktree.mainId);
    if (mainBranch) {
      updatedBranches.set(worktree.mainId, { ...mainBranch, status: "locked" });
    }
  }

  return {
    branch: newBranch,
    worktree: {
      ...worktree,
      branches: updatedBranches,
      scenarios: [...worktree.scenarios, newBranch.id],
      highestScenarioNumber: newNumber,
    },
  };
};
