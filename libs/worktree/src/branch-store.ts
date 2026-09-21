import type { ChangeSet, Direction } from "@epanet-js/change-set";
import type { Branch, Worktree } from "./types";
import { initializeWorktree } from "./initialize-worktree";

export type StoredBranches = {
  worktree: Worktree;
  deltas: Map<string, ChangeSet>;
};

export interface BranchStore {
  load(): Promise<StoredBranches>;
  createBranch(worktree: Worktree, branch: Branch): Promise<void>;
  renameBranch(branchId: string, name: string): Promise<void>;
  deleteBranch(branchId: string): Promise<void>;
  recordChange(
    branchId: string,
    changeSet: ChangeSet,
    direction: Direction,
  ): Promise<void>;
}

export const nullBranchStore: BranchStore = {
  load: () =>
    Promise.resolve({ worktree: initializeWorktree(), deltas: new Map() }),
  createBranch: () => Promise.resolve(),
  renameBranch: () => Promise.resolve(),
  deleteBranch: () => Promise.resolve(),
  recordChange: () => Promise.resolve(),
};
