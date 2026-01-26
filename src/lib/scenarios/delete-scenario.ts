import type { Worktree } from "src/state/scenarios";
import type { ScenarioOperationResult } from "./types";

export const deleteScenario = (
  worktree: Worktree,
  scenarioId: string,
): ScenarioOperationResult => {
  if (!worktree.scenarios.includes(scenarioId)) {
    return { worktree, snapshot: null };
  }

  const scenarioToDelete = worktree.snapshots.get(scenarioId);
  if (!scenarioToDelete) {
    return { worktree, snapshot: null };
  }

  const remainingScenarioIds = worktree.scenarios.filter(
    (id) => id !== scenarioId,
  );
  const isDeletedActive = worktree.activeSnapshotId === scenarioId;
  const isLastScenario = remainingScenarioIds.length === 0;

  const updatedSnapshots = new Map(worktree.snapshots);
  updatedSnapshots.delete(scenarioId);

  if (isLastScenario) {
    const mainSnapshot = worktree.snapshots.get(worktree.mainId);
    if (mainSnapshot) {
      updatedSnapshots.set(worktree.mainId, {
        ...mainSnapshot,
        status: "open",
      });
    }
    const unlockedMain = updatedSnapshots.get(worktree.mainId);

    return {
      worktree: {
        ...worktree,
        snapshots: updatedSnapshots,
        scenarios: [],
        activeSnapshotId: worktree.mainId,
        lastActiveSnapshotId: worktree.mainId,
        highestScenarioNumber: 0,
      },
      snapshot: unlockedMain ?? null,
    };
  }

  if (isDeletedActive) {
    const nextScenarioId = remainingScenarioIds[0];
    const nextScenario = updatedSnapshots.get(nextScenarioId);

    return {
      worktree: {
        ...worktree,
        snapshots: updatedSnapshots,
        scenarios: remainingScenarioIds,
        activeSnapshotId: nextScenarioId,
        lastActiveSnapshotId: nextScenarioId,
      },
      snapshot: nextScenario ?? null,
    };
  }

  return {
    worktree: {
      ...worktree,
      snapshots: updatedSnapshots,
      scenarios: remainingScenarioIds,
      lastActiveSnapshotId:
        worktree.lastActiveSnapshotId === scenarioId
          ? worktree.mainId
          : worktree.lastActiveSnapshotId,
    },
    snapshot: null,
  };
};
