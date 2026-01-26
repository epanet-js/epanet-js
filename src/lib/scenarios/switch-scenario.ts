import type { Worktree } from "src/state/scenarios";
import type { ScenarioContext, ScenarioOperationResult } from "./types";

export const switchToSnapshot = (
  worktree: Worktree,
  targetSnapshotId: string,
  context: ScenarioContext,
): ScenarioOperationResult => {
  if (worktree.activeSnapshotId === targetSnapshotId) {
    return { worktree, snapshot: null };
  }

  const targetSnapshot = worktree.snapshots.get(targetSnapshotId);
  if (!targetSnapshot) {
    throw new Error(`Snapshot ${targetSnapshotId} not found`);
  }

  const updatedSnapshots = new Map(worktree.snapshots);
  const currentSnapshot = worktree.snapshots.get(worktree.activeSnapshotId);

  if (currentSnapshot) {
    updatedSnapshots.set(worktree.activeSnapshotId, {
      ...currentSnapshot,
      momentLog: context.currentMomentLog,
      simulation: context.currentSimulation,
      version: context.currentModelVersion,
    });
  }

  return {
    worktree: {
      ...worktree,
      snapshots: updatedSnapshots,
      activeSnapshotId: targetSnapshotId,
      lastActiveSnapshotId: worktree.activeSnapshotId,
    },
    snapshot: targetSnapshot,
  };
};

export const switchToScenario = (
  worktree: Worktree,
  scenarioId: string,
  context: ScenarioContext,
): ScenarioOperationResult => {
  return switchToSnapshot(worktree, scenarioId, context);
};

export const switchToMain = (
  worktree: Worktree,
  context: ScenarioContext,
): ScenarioOperationResult => {
  return switchToSnapshot(worktree, worktree.mainId, context);
};
