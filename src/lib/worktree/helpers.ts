import type { Worktree, Branch, Version, Snapshot } from "./types";

// Branch accessors
export const getActiveBranch = (worktree: Worktree): Branch | undefined =>
  worktree.branches.get(worktree.activeBranchId);

export const getMainBranch = (worktree: Worktree): Branch | undefined =>
  worktree.branches.get("main");

export const getBranch = (
  worktree: Worktree,
  branchId: string,
): Branch | undefined => worktree.branches.get(branchId);

export const getScenarios = (worktree: Worktree): Branch[] =>
  [...worktree.branches.values()].filter((b) => b.id !== "main");

export const isMainBranch = (branchId: string): boolean => branchId === "main";

// Version accessors
export const getVersion = (
  worktree: Worktree,
  versionId: string,
): Version | undefined => worktree.versions.get(versionId);

export const getHeadVersion = (
  worktree: Worktree,
  branchId: string,
): Version | undefined => {
  const branch = worktree.branches.get(branchId);
  return branch ? worktree.versions.get(branch.headRevisionId) : undefined;
};

export const getActiveHeadVersion = (
  worktree: Worktree,
): Version | undefined => {
  const branch = getActiveBranch(worktree);
  return branch ? worktree.versions.get(branch.headRevisionId) : undefined;
};

// Snapshot accessors
export const getSnapshot = (
  worktree: Worktree,
  branchId: string,
): Snapshot | undefined => {
  const version = getHeadVersion(worktree, branchId);
  return version?.snapshot;
};

export const getActiveSnapshot = (worktree: Worktree): Snapshot | undefined => {
  const version = getActiveHeadVersion(worktree);
  return version?.snapshot;
};

// Locking: main is locked if any scenarios exist
export const isMainLocked = (worktree: Worktree): boolean => {
  return getScenarios(worktree).length > 0;
};

// Draft checks
export const hasDraft = (branch: Branch): boolean =>
  branch.draftVersionId !== null;

export const activeBranchHasDraft = (worktree: Worktree): boolean => {
  const branch = getActiveBranch(worktree);
  return branch ? hasDraft(branch) : false;
};
