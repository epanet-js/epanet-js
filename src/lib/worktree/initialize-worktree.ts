import type { Worktree, ScenarioContext, Snapshot } from "./types";
import type { CapturedSnapshot } from "./capture-snapshot";

const MAIN_ID = "main";

export const initializeWorktree = (
  captured: CapturedSnapshot,
  context: ScenarioContext,
): Worktree => {
  const mainSnapshot: Snapshot = {
    id: MAIN_ID,
    name: "Main",
    parentId: null,
    deltas: [captured.moment],
    version: captured.version,
    momentLog: context.currentMomentLog,
    simulation: context.currentSimulation,
    status: "open",
  };

  return {
    activeSnapshotId: MAIN_ID,
    lastActiveSnapshotId: MAIN_ID,
    snapshots: new Map([[MAIN_ID, mainSnapshot]]),
    mainId: MAIN_ID,
    scenarios: [],
    highestScenarioNumber: 0,
  };
};
