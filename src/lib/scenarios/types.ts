import type { MomentLog } from "src/lib/persistence/moment-log";
import type { BaseModelSnapshot, ScenariosState } from "src/state/scenarios";
import type { SimulationState } from "src/state/jotai";

export type ScenarioApplyTarget = {
  baseSnapshot: BaseModelSnapshot;
  momentLog: MomentLog;
  modelVersion: string;
} | null;

export interface ScenarioContext {
  currentMomentLog: MomentLog;
  currentModelVersion: string;
  currentSimulation: SimulationState;
}

export interface ScenarioOperationResult {
  state: ScenariosState;
  applyTarget: ScenarioApplyTarget;
  simulation: SimulationState | null;
}

export interface CreateScenarioResult extends ScenarioOperationResult {
  scenarioId: string;
  scenarioName: string;
}
