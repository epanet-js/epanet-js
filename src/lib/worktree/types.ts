import type { MomentLog } from "src/lib/persistence/moment-log";
import type { Moment } from "src/lib/persistence/moment";
import type { SimulationState } from "src/state/jotai";

export interface BaseModelSnapshot {
  moment: Moment;
  stateId: string;
}

export type Snapshot = {
  id: string;
  name: string;
  base: BaseModelSnapshot;
  version: string;
  momentLog: MomentLog;
  simulation: SimulationState | null;
  status: "open" | "locked";
};

export interface Worktree {
  activeSnapshotId: string;
  lastActiveSnapshotId: string;
  snapshots: Map<string, Snapshot>;
  mainId: string;
  scenarios: string[];
  highestScenarioNumber: number;
}

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
