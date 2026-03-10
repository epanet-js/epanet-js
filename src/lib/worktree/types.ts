import type { MomentLog } from "src/lib/persistence/moment-log";
import type { Moment } from "src/lib/persistence/moment";
import type { SimulationState } from "src/state/simulation";
import type { SimulationSettings } from "src/simulation/simulation-settings";

export type Snapshot = {
  id: string;
  name: string;
  parentId: string | null;
  deltas: Moment[];
  version: string;
  momentLog: MomentLog;
  simulation: SimulationState | null;
  simulationSettings: SimulationSettings;
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

export interface ScenarioOperationResult {
  worktree: Worktree;
  snapshot: Snapshot | null;
}
