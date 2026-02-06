import type { Worktree, Branch, Version, Snapshot } from "./types";
import type { Moment } from "src/lib/persistence/moment";
import { MomentLog } from "src/lib/persistence/moment-log";
import { nanoid } from "nanoid";
import { getVersion } from "./helpers";

export const promoteVersion = (
  worktree: Worktree,
  versionId: string,
  name: string,
): { branch: Branch; worktree: Worktree } => {
  const sourceVersion = getVersion(worktree, versionId);
  if (!sourceVersion) {
    throw new Error(`Version ${versionId} not found`);
  }

  const model = sourceVersion.snapshot.hydraulicModel;

  const snapshotMoment: Moment = {
    note: "Pinned",
    putAssets: [...model.assets.values()],
    deleteAssets: [],
    putDemands: model.demands,
    putEPSTiming: model.epsTiming,
    putControls: model.controls,
    putCustomerPoints: [...model.customerPoints.values()],
    putCurves: [...model.curvesDeprecated.values()],
  };

  const newBranchId = nanoid();
  const revisionId = nanoid();
  const draftId = nanoid();

  const revisionSnapshot: Snapshot = {
    versionId: revisionId,
    hydraulicModel: model,
  };

  const revision: Version = {
    id: revisionId,
    message: "Pinned",
    deltas: [snapshotMoment],
    parentId: null,
    status: "revision",
    timestamp: Date.now(),
    snapshot: revisionSnapshot,
  };

  const draftSnapshot: Snapshot = {
    versionId: draftId,
    hydraulicModel: model,
  };

  const draft: Version = {
    id: draftId,
    message: "",
    deltas: [],
    parentId: revisionId,
    status: "draft",
    timestamp: Date.now(),
    snapshot: draftSnapshot,
  };

  const newSessionHistory = new MomentLog();
  newSessionHistory.setSnapshot(snapshotMoment, draftId);
  newSessionHistory.setBaseStateId(draftId);

  const newBranch: Branch = {
    id: newBranchId,
    name,
    headRevisionId: revisionId,
    simulation: null,
    sessionHistory: newSessionHistory,
    draftVersionId: draftId,
  };

  const updatedBranches = new Map(worktree.branches);
  updatedBranches.set(newBranchId, newBranch);

  const updatedVersions = new Map(worktree.versions);
  updatedVersions.set(revisionId, revision);
  updatedVersions.set(draftId, draft);

  return {
    branch: newBranch,
    worktree: {
      ...worktree,
      branches: updatedBranches,
      versions: updatedVersions,
      highestScenarioNumber: worktree.highestScenarioNumber,
    },
  };
};
