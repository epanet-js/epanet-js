import type { MomentLog } from "src/lib/persistence/moment-log";
import type { ModelMoment } from "src/hydraulic-model/model-operation";
import type { SimulationState } from "src/state/simulation";
import type { SimulationSettings } from "src/simulation/simulation-settings";

export type Snapshot = {
  id: string;
  name: string;
  parentId: string | null;
  deltas: ModelMoment[];
  version: string;
  momentLog: MomentLog;
  simulation: SimulationState | null;
  simulationSourceId: string;
  simulationSettings: SimulationSettings;
  status: "open" | "locked";
};

export type Branch = {
  id: string;
  name: string;
  parentId: string | null;
  status: "open" | "locked";
};

export interface Worktree {
  activeSnapshotId: string;
  lastActiveSnapshotId: string;
  snapshots: Map<string, Snapshot>;
  branches: Map<string, Branch>;
  mainId: string;
  scenarios: string[];
  highestScenarioNumber: number;
}

export interface ScenarioOperationResult {
  worktree: Worktree;
  snapshot: Snapshot | null;
}
