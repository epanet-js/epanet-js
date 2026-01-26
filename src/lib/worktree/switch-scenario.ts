import type { Worktree } from "src/state/scenarios";
import type { ScenarioOperationResult } from "./types";

export const switchToSnapshot = (
  worktree: Worktree,
  targetSnapshotId: string,
): ScenarioOperationResult => {
  if (worktree.activeSnapshotId === targetSnapshotId) {
    return { worktree, snapshot: null };
  }

  const targetSnapshot = worktree.snapshots.get(targetSnapshotId);
  if (!targetSnapshot) {
    throw new Error(`Snapshot ${targetSnapshotId} not found`);
  }

  return {
    worktree: {
      ...worktree,
      activeSnapshotId: targetSnapshotId,
      lastActiveSnapshotId: worktree.activeSnapshotId,
    },
    snapshot: targetSnapshot,
  };
};

export const switchToScenario = (
  worktree: Worktree,
  scenarioId: string,
): ScenarioOperationResult => {
  return switchToSnapshot(worktree, scenarioId);
};

export const switchToMain = (worktree: Worktree): ScenarioOperationResult => {
  return switchToSnapshot(worktree, worktree.mainId);
};
