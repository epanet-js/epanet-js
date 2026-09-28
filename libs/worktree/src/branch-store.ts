import type { ChangeSet, Direction } from "@epanet-js/change-set";
import type { Branch, Worktree } from "./types";
import { initializeWorktree } from "./initialize-worktree";

export type StoredBranches = {
  worktree: Worktree;
  deltas: Map<string, ChangeSet>;
  simulationSettings: Map<string, string>;
};

export interface BranchStore {
  load(): Promise<StoredBranches>;
  loadDelta(branchId: string): Promise<ChangeSet>;
  createBranch(worktree: Worktree, branch: Branch): Promise<void>;
  renameBranch(branchId: string, name: string): Promise<void>;
  deleteBranch(branchId: string): Promise<void>;
  recordChange(
    branchId: string,
    changeSet: ChangeSet,
    direction: Direction,
  ): Promise<void>;
  recordSimulationSettings(branchId: string, data: string): Promise<void>;
}

export const nullBranchStore: BranchStore = {
  load: () =>
    Promise.resolve({
      worktree: initializeWorktree(),
      deltas: new Map(),
      simulationSettings: new Map(),
    }),
  loadDelta: (branchId) =>
    Promise.reject(new Error(`No stored delta for ${branchId}`)),
  createBranch: () => Promise.resolve(),
  renameBranch: () => Promise.resolve(),
  deleteBranch: () => Promise.resolve(),
  recordChange: () => Promise.resolve(),
  recordSimulationSettings: () => Promise.resolve(),
};
