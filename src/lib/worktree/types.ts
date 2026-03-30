import type { MomentLog } from "src/lib/persistence/moment-log";
import type { Moment } from "src/lib/persistence/moment";
import type { SimulationState } from "src/state/simulation";
import type { SimulationSettings } from "src/simulation/simulation-settings";
import type { LabelType } from "src/hydraulic-model/label-manager";

export type Snapshot = {
  id: string;
  name: string;
  parentId: string | null;
  deltas: Moment[];
  version: string;
  momentLog: MomentLog;
  simulation: SimulationState | null;
  simulationSourceId: string;
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
  labelCounters: Map<LabelType, number>;
}

export interface ScenarioOperationResult {
  worktree: Worktree;
  snapshot: Snapshot | null;
}
