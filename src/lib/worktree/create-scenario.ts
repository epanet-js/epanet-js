import type { Worktree, Branch, Version, Snapshot } from "./types";
import { MomentLog } from "src/lib/persistence/moment-log";
import { nanoid } from "nanoid";
import { getMainBranch, getHeadVersion } from "./helpers";

export const createScenario = (
  worktree: Worktree,
): { scenario: Branch; worktree: Worktree } => {
  const mainBranch = getMainBranch(worktree);
  if (!mainBranch) {
    throw new Error("Main branch not found");
  }

  const mainVersion = getHeadVersion(worktree, "main");
  if (!mainVersion) {
    throw new Error("Main branch has no head version");
  }

  const baseMoment = mainVersion.deltas[0];
  if (!baseMoment) {
    throw new Error("Cannot create scenario: no model imported yet");
  }

  const newNumber = worktree.highestScenarioNumber + 1;
  const newBranchId = nanoid();
  const newVersionId = nanoid();

  // Create a new MomentLog for this scenario, initialized with the main's state
  const newSessionHistory = new MomentLog();
  newSessionHistory.setSnapshot(baseMoment, mainVersion.id);

  // The new scenario's snapshot shares the same hydraulicModel as main's snapshot
  const newSnapshot: Snapshot = {
    versionId: newVersionId,
    hydraulicModel: mainVersion.snapshot.hydraulicModel,
  };

  // Create the scenario's initial version, based on main's deltas
  const newVersion: Version = {
    id: newVersionId,
    message: "",
    deltas: mainBranch.sessionHistory.getDeltas(),
    parentId: mainVersion.id,
    status: "revision",
    timestamp: Date.now(),
    snapshot: newSnapshot,
  };

  // Create the new branch
  const newBranch: Branch = {
    id: newBranchId,
    name: `Scenario #${newNumber}`,
    headRevisionId: newVersionId,
    simulation: null,
    sessionHistory: newSessionHistory,
    draftVersionId: null,
  };

  const updatedBranches = new Map(worktree.branches);
  updatedBranches.set(newBranchId, newBranch);

  const updatedVersions = new Map(worktree.versions);
  updatedVersions.set(newVersionId, newVersion);

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
