import type { BaseModelSnapshot, Worktree } from "src/state/scenarios";
import type { ScenarioContext, Snapshot } from "./types";

export const initializeWorktree = (
  baseSnapshot: BaseModelSnapshot,
  context: ScenarioContext,
): Worktree => {
  const mainRevision: Snapshot = {
    id: "main",
    name: "Main",
    base: baseSnapshot,
    version: context.currentModelVersion,
    momentLog: context.currentMomentLog,
    simulation: context.currentSimulation,
    status: "open",
  };

  return {
    activeScenarioId: null,
    lastActiveScenarioId: null,
    scenarios: new Map(),
    highestScenarioNumber: 0,
    mainRevision,
  };
};
