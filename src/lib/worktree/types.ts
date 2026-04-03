import type { MomentLog } from "src/lib/persistence/moment-log";
import type { ModelMoment } from "src/hydraulic-model/model-operation";
import type { SimulationState } from "src/state/simulation";
import type { SimulationSettings } from "src/simulation/simulation-settings";
import type { LabelType } from "src/hydraulic-model/label-manager";
import type { IdGenerator } from "src/lib/id-generator";

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

export interface Worktree {
  activeSnapshotId: string;
  lastActiveSnapshotId: string;
  snapshots: Map<string, Snapshot>;
  mainId: string;
  scenarios: string[];
  highestScenarioNumber: number;
  labelCounters: Map<LabelType, number>;
  idGenerator: IdGenerator;
}

export interface ScenarioOperationResult {
  worktree: Worktree;
  snapshot: Snapshot | null;
}
