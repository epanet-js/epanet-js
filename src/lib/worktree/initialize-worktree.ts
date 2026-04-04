import type { MomentLog } from "src/lib/persistence/moment-log";
import type { ModelMoment } from "src/hydraulic-model/model-operation";
import type { SimulationSettings } from "src/simulation/simulation-settings";
import type { Snapshot, Worktree } from "./types";

type InitializeWorktreeInput = {
  snapshotMoment?: ModelMoment;
  momentLog: MomentLog;
  version: string;
  simulationSettings: SimulationSettings;
};

export const initializeWorktree = ({
  snapshotMoment,
  momentLog,
  version,
  simulationSettings,
}: InitializeWorktreeInput): Worktree => {
  const mainSnapshot: Snapshot = {
    id: "main",
    name: "Main",
    parentId: null,
    deltas: snapshotMoment ? [snapshotMoment] : [],
    version,
    momentLog,
    simulation: { status: "idle" },
    simulationSourceId: "main",
    simulationSettings,
    status: "open",
  };

  return {
    activeSnapshotId: "main",
    lastActiveSnapshotId: "main",
    snapshots: new Map([["main", mainSnapshot]]),
    mainId: "main",
    scenarios: [],
    highestScenarioNumber: 0,
  };
};
