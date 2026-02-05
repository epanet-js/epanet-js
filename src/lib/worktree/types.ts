import type { MomentLog } from "src/lib/persistence/moment-log";
import type { Moment } from "src/lib/persistence/moment";
import type { SimulationState } from "src/state/jotai";
import { HydraulicModel } from "src/hydraulic-model";

export type VersionId = string;
export type BranchId = string;

export type Snapshot = {
  versionId: VersionId;
  hydraulicModel: HydraulicModel;
};

type EphemeralBranchState = {
  simulation: SimulationState | null;
  sessionHistory: MomentLog;
  draftVersionId: VersionId | null;
};

export type Branch = {
  id: BranchId;
  name: string;
  headRevisionId: VersionId;
} & EphemeralBranchState;

export type EphemeralVersionState = {
  snapshot: Snapshot;
};

export type Version = {
  id: VersionId;
  message: string;
  deltas: Moment[];
  parentId: VersionId | null;
  status: "revision" | "draft";
  timestamp: number;
} & EphemeralVersionState;

export interface Worktree {
  activeBranchId: BranchId;
  lastActiveBranchId: BranchId;
  branches: Map<BranchId, Branch>;
  versions: Map<VersionId, Version>;
  highestScenarioNumber: number;
}

export interface BranchOperationResult {
  worktree: Worktree;
  branch: Branch | null;
}
