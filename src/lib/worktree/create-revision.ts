import type { Worktree, Version, Branch, Snapshot } from "./types";
import { MomentLog } from "src/lib/persistence/moment-log";
import { nanoid } from "nanoid";
import { getBranch, getVersion } from "./helpers";
import { HydraulicModel } from "src/hydraulic-model";
import { rebaseChildBranches } from "./rebase-branches";

export type CreateRevisionResult = {
  worktree: Worktree;
  rebasedBranchIds: string[];
};

export const createRevision = (
  worktree: Worktree,
  branchId: string,
  hydraulicModel: HydraulicModel,
  message: string,
): CreateRevisionResult => {
  const branch = getBranch(worktree, branchId);
  if (!branch || !branch.draftVersionId) {
    throw new Error("No draft to commit");
  }

  const oldHeadRevisionId = branch.headRevisionId;

  const draft = getVersion(worktree, branch.draftVersionId);
  if (!draft) {
    throw new Error("Draft version not found");
  }

  const revisionSnapshot: Snapshot = {
    versionId: draft.id,
    hydraulicModel,
  };

  const revision: Version = {
    ...draft,
    status: "revision",
    message,
    timestamp: Date.now(),
    snapshot: revisionSnapshot,
  };

  const newDraftId = nanoid();

  const newDraftSnapshot: Snapshot = {
    versionId: newDraftId,
    hydraulicModel,
  };

  const newDraft: Version = {
    id: newDraftId,
    message: "",
    deltas: [],
    parentId: revision.id,
    status: "draft",
    timestamp: Date.now(),
    snapshot: newDraftSnapshot,
  };

  const newSessionHistory = new MomentLog();
  newSessionHistory.setBaseStateId(newDraftId);

  const updatedBranch: Branch = {
    ...branch,
    headRevisionId: revision.id,
    draftVersionId: newDraftId,
    sessionHistory: newSessionHistory,
  };

  const updatedVersions = new Map(worktree.versions);
  updatedVersions.set(revision.id, revision);
  updatedVersions.set(newDraftId, newDraft);

  const updatedBranches = new Map(worktree.branches);
  updatedBranches.set(branchId, updatedBranch);

  const committed: Worktree = {
    ...worktree,
    branches: updatedBranches,
    versions: updatedVersions,
  };

  return rebaseChildBranches(
    committed,
    branchId,
    oldHeadRevisionId,
    revision.id,
  );
};
