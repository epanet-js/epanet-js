import type { Branch, Worktree } from "./types";

export interface BranchingRules {
  readonly isAvailable: boolean;
  createBranch(worktree: Worktree): {
    worktree: Worktree;
    created: Branch | null;
  };
  switchToBranch(
    worktree: Worktree,
    branchId: string,
  ): { worktree: Worktree; activated: Branch | null };
  deleteBranch(
    worktree: Worktree,
    branchId: string,
  ): { worktree: Worktree; nextActive: Branch | null };
  renameBranch(worktree: Worktree, branchId: string, name: string): Worktree;
}

export const nullBranchingRules: BranchingRules = {
  isAvailable: false,
  createBranch: (worktree) => ({ worktree, created: null }),
  switchToBranch: (worktree) => ({ worktree, activated: null }),
  deleteBranch: (worktree) => ({ worktree, nextActive: null }),
  renameBranch: (worktree) => worktree,
};
