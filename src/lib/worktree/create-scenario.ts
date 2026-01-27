import type { Worktree, Snapshot } from "./types";
import { MomentLog } from "src/lib/persistence/moment-log";
import { nanoid } from "nanoid";

export const createScenario = (
  worktree: Worktree,
): { scenario: Snapshot; worktree: Worktree } => {
  const mainSnapshot = worktree.snapshots.get(worktree.mainId);
  if (!mainSnapshot) {
    throw new Error("Main snapshot not found");
  }

  const baseMoment = mainSnapshot.deltas[0];
  if (!baseMoment) {
    throw new Error("Cannot create scenario: no model imported yet");
  }
  const newNumber = worktree.highestScenarioNumber + 1;
  const newMomentLog = new MomentLog();
  newMomentLog.setSnapshot(baseMoment, mainSnapshot.version);

  const newScenario: Snapshot = {
    id: nanoid(),
    name: `Scenario #${newNumber}`,
    parentId: worktree.mainId,
    deltas: [],
    version: mainSnapshot.version,
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
