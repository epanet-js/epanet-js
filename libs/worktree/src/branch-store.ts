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

export type StoredBranchesDeprecated = {
  worktree: Worktree;
  deltas: Map<string, ChangeSet>;
  simulationSettings: Map<string, string>;
};

export interface BranchStore {
  load(): Promise<StoredBranches>;
  loadDeprecated(): Promise<StoredBranchesDeprecated>;
  loadBranch(branchId: string): Promise<StoredBranch>;
  createBranch(worktree: Worktree, branch: Branch): Promise<void>;
  renameBranch(branchId: string, name: string): Promise<void>;
  deleteBranch(branchId: string): Promise<void>;
  recordChange(
    branchId: string,
    changeSet: ChangeSet,
    direction: Direction,
  ): Promise<void>;
  recordChangeDeprecated(
    branchId: string,
    changeSet: ChangeSet,
    direction: Direction,
  ): Promise<void>;
  recordSimulationSettings(branchId: string, data: string): Promise<void>;
}

export const nullBranchStore: BranchStore = {
  load: () => Promise.resolve({ worktree: initializeWorktree() }),
  loadDeprecated: () =>
    Promise.resolve({
      worktree: initializeWorktree(),
      deltas: new Map(),
      simulationSettings: new Map(),
    }),
  loadBranch: (branchId) =>
    Promise.reject(new Error(`No stored branch ${branchId}`)),
  createBranch: () => Promise.resolve(),
  renameBranch: () => Promise.resolve(),
  deleteBranch: () => Promise.resolve(),
  recordChange: () => Promise.resolve(),
  recordChangeDeprecated: () => Promise.resolve(),
  recordSimulationSettings: () => Promise.resolve(),
};
