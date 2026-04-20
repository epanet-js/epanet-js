export type Branch = {
  id: string;
  name: string;
  parentId: string | null;
  status: "open" | "locked";
};

export interface Worktree {
  activeBranchId: string;
  lastActiveBranchId: string;
  branches: Map<string, Branch>;
  mainId: string;
  scenarios: string[];
  highestScenarioNumber: number;
}

export interface ScenarioOperationResult {
  worktree: Worktree;
  branch: Branch | null;
}
