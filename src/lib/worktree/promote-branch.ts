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

  // Walk the full version chain to collect all deltas from root to source.
  // This is necessary because after a rebase, the snapshot.hydraulicModel on
  // the source version may be stale (it was captured before the rebase), but
  // the deltas on each version in the chain are always correct.
  const allDeltas: Moment[] = [];
  let current: Version | undefined = sourceVersion;
  while (current) {
    allDeltas.unshift(...current.deltas);
    current = current.parentId
      ? worktree.versions.get(current.parentId)
      : undefined;
  }

  const model = sourceVersion.snapshot.hydraulicModel;

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
    deltas: allDeltas,
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
