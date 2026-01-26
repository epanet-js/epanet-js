import type { Worktree, Snapshot } from "src/state/scenarios";
import { MomentLog } from "src/lib/persistence/moment-log";
import { nanoid } from "nanoid";

export const createScenario = (
  worktree: Worktree,
): { scenario: Snapshot; worktree: Worktree } => {
  const mainSnapshot = worktree.snapshots.get(worktree.mainId);
  if (!mainSnapshot) {
    throw new Error("Main snapshot not found");
  }

  const base = mainSnapshot.base;
  const newNumber = worktree.highestScenarioNumber + 1;
  const newMomentLog = new MomentLog();
  newMomentLog.setSnapshot(base.moment, base.stateId);

  const newScenario: Snapshot = {
    id: nanoid(),
    name: `Scenario #${newNumber}`,
    base,
    version: base.stateId,
    momentLog: newMomentLog,
    simulation: null,
    status: "open",
  };

  const updatedSnapshots = new Map(worktree.snapshots);
  updatedSnapshots.set(newScenario.id, newScenario);

  const isFirstScenario = worktree.scenarios.length === 0;
  if (isFirstScenario) {
    updatedSnapshots.set(worktree.mainId, {
      ...mainSnapshot,
      status: "locked",
    });
  }

  return {
    scenario: newScenario,
    worktree: {
      ...worktree,
      snapshots: updatedSnapshots,
      scenarios: [...worktree.scenarios, newScenario.id],
      highestScenarioNumber: newNumber,
    },
  };
};
