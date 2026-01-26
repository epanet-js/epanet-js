import type { BaseModelSnapshot, Worktree } from "src/state/scenarios";
import type { ScenarioContext, Snapshot } from "./types";

const MAIN_ID = "main";

export const initializeWorktree = (
  baseSnapshot: BaseModelSnapshot,
  context: ScenarioContext,
): Worktree => {
  const mainSnapshot: Snapshot = {
    id: MAIN_ID,
    name: "Main",
    base: baseSnapshot,
    version: context.currentModelVersion,
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
