import type { MomentLog } from "src/lib/persistence/moment-log";
import type { BaseModelSnapshot, Worktree } from "src/state/scenarios";
import type { SimulationState } from "src/state/jotai";

export type Snapshot = {
  id: string;
  name: string;
  base: BaseModelSnapshot;
  version: string;
  momentLog: MomentLog;
  simulation: SimulationState | null;
  status: "open" | "locked";
};

export const buildSnapshot = (
  id: string,
  name: string,
  base: BaseModelSnapshot,
  version: string,
  momentLog: MomentLog,
  simulation: SimulationState | null,
  status: "open" | "locked" = "open",
): Snapshot => ({
  id,
  name,
  base,
  version,
  momentLog,
  simulation,
  status,
});

export interface ScenarioContext {
  currentMomentLog: MomentLog;
  currentModelVersion: string;
  currentSimulation: SimulationState;
}

export interface ScenarioOperationResult {
  worktree: Worktree;
  snapshot: Snapshot | null;
}
