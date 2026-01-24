import type { BaseModelSnapshot, Worktree } from "src/state/scenarios";
import type { ScenarioContext } from "./types";

export const initializeWorktree = (
  baseSnapshot: BaseModelSnapshot,
  context: ScenarioContext,
): Worktree => ({
  activeScenarioId: null,
  lastActiveScenarioId: null,
  scenarios: new Map(),
  highestScenarioNumber: 0,
  baseModelSnapshot: baseSnapshot,
  mainMomentLog: context.currentMomentLog,
  mainSimulation: context.currentSimulation,
  mainModelVersion: context.currentModelVersion,
});
