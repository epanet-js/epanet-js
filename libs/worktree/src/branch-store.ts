import type { ChangeSet, Direction } from "@epanet-js/change-set";
import type { Branch, Worktree } from "./types";
import { initializeWorktree } from "./initialize-worktree";

export type StoredBranches = {
  worktree: Worktree;
};

export type StoredBranch = {
  delta: ChangeSet;
  simulationSettings: string | null;
};

export interface BranchStore {
  load(): Promise<StoredBranches>;
  loadBranch(branchId: string): Promise<StoredBranch>;
  createBranch(worktree: Worktree, branch: Branch): Promise<void>;
  duplicateBranch(
    worktree: Worktree,
    sourceId: string,
    branch: Branch,
  ): Promise<void>;
  renameBranch(branchId: string, name: string): Promise<void>;
  deleteBranch(branchId: string): Promise<void>;
  recordChange(
    branchId: string,
    changeSet: ChangeSet,
    direction: Direction,
  ): Promise<void>;
  recordSimulationSettings(branchId: string, data: string): Promise<void>;
  exportBranch(branchId: string, projectSettings: string): Promise<Uint8Array>;
}

export const nullBranchStore: BranchStore = {
  load: () => Promise.resolve({ worktree: initializeWorktree() }),
  loadBranch: (branchId) =>
    Promise.reject(new Error(`No stored branch ${branchId}`)),
  createBranch: () => Promise.resolve(),
  duplicateBranch: () => Promise.resolve(),
  renameBranch: () => Promise.resolve(),
  deleteBranch: () => Promise.resolve(),
  recordChange: () => Promise.resolve(),
  recordSimulationSettings: () => Promise.resolve(),
  exportBranch: (branchId) =>
    Promise.reject(new Error(`No stored branch ${branchId}`)),
};
