import type { Worktree } from "src/state/scenarios";

export const renameScenario = (
  worktree: Worktree,
  scenarioId: string,
  newName: string,
): Worktree => {
  const snapshot = worktree.snapshots.get(scenarioId);
  if (!snapshot) return worktree;

  const updatedSnapshots = new Map(worktree.snapshots);
  updatedSnapshots.set(scenarioId, { ...snapshot, name: newName });

  return { ...worktree, snapshots: updatedSnapshots };
};
