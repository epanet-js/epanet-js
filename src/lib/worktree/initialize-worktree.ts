import type { MomentLog } from "src/lib/persistence/moment-log";
import type { Moment } from "src/lib/persistence/moment";
import type { IdGenerator } from "src/lib/id-generator";
import type { SimulationSettings } from "src/simulation/simulation-settings";
import type { LabelType } from "src/hydraulic-model/label-manager";
import type { Snapshot, Worktree } from "./types";

type InitializeWorktreeInput = {
  snapshotMoment: Moment;
  momentLog: MomentLog;
  version: string;
  simulationSettings: SimulationSettings;
  labelCounters: Map<LabelType, number>;
  idGenerator: IdGenerator;
};

export const initializeWorktree = ({
  snapshotMoment,
  momentLog,
  version,
  simulationSettings,
  labelCounters,
  idGenerator,
}: InitializeWorktreeInput): Worktree => {
  const mainSnapshot: Snapshot = {
    id: "main",
    name: "Main",
    parentId: null,
    deltas: [snapshotMoment],
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
    labelCounters,
    idGenerator,
  };
};
