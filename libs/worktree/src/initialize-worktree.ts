import type { Branch, Worktree } from "./types";

export const initializeWorktree = (): Worktree => {
  const mainBranch: Branch = {
    id: "main",
    name: "Main",
    parentId: null,
    status: "open",
  };

  return {
    activeBranchId: "main",
    lastActiveBranchId: "main",
    branches: new Map([["main", mainBranch]]),
    mainId: "main",
    scenarios: [],
    highestScenarioNumber: 0,
  };
};
