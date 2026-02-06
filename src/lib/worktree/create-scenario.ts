import type { Worktree, Branch, Version, Snapshot } from "./types";
import type { Moment } from "src/lib/persistence/moment";
import { MomentLog } from "src/lib/persistence/moment-log";
import { nanoid } from "nanoid";
import { getMainBranch, getHeadVersion, getVersion } from "./helpers";

export const createScenario = (
  worktree: Worktree,
  fromVersionId?: string,
): { scenario: Branch; worktree: Worktree } => {
  const sourceVersion = fromVersionId
    ? getVersion(worktree, fromVersionId)
    : getHeadVersion(worktree, "main");

  if (!sourceVersion) {
    throw new Error(
      fromVersionId
        ? `Version ${fromVersionId} not found`
        : "Main branch has no head version",
    );
  }

  if (!fromVersionId) {
    const mainBranch = getMainBranch(worktree);
    if (!mainBranch) {
      throw new Error("Main branch not found");
    }
  }

  const model = sourceVersion.snapshot.hydraulicModel;
  const snapshotMoment: Moment = {
    note: "Snapshot",
    putAssets: [...model.assets.values()],
    deleteAssets: [],
    putDemands: model.demands,
    putEPSTiming: model.epsTiming,
    putControls: model.controls,
    putCustomerPoints: [...model.customerPoints.values()],
    putCurves: [...model.curvesDeprecated.values()],
  };

  const newNumber = worktree.highestScenarioNumber + 1;
  const newBranchId = nanoid();
  const draftVersionId = nanoid();

  const newSessionHistory = new MomentLog();
  newSessionHistory.setSnapshot(snapshotMoment, draftVersionId);
  newSessionHistory.setBaseStateId(draftVersionId);

  const draftSnapshot: Snapshot = {
    versionId: draftVersionId,
    hydraulicModel: sourceVersion.snapshot.hydraulicModel,
  };

  const draftVersion: Version = {
    id: draftVersionId,
    message: "",
    deltas: [],
    parentId: sourceVersion.id,
    status: "draft",
    timestamp: Date.now(),
    snapshot: draftSnapshot,
  };

  const newBranch: Branch = {
    id: newBranchId,
    name: `Scenario #${newNumber}`,
    headRevisionId: sourceVersion.id,
    simulation: null,
    sessionHistory: newSessionHistory,
    draftVersionId: draftVersionId,
  };

  const updatedBranches = new Map(worktree.branches);
  updatedBranches.set(newBranchId, newBranch);

  const updatedVersions = new Map(worktree.versions);
  updatedVersions.set(draftVersionId, draftVersion);

  return {
    scenario: newBranch,
    worktree: {
      ...worktree,
      branches: updatedBranches,
      versions: updatedVersions,
      highestScenarioNumber: newNumber,
    },
  };
};
