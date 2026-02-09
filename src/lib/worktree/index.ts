export type {
  Worktree,
  Snapshot,
  Branch,
  Version,
  VersionId,
  BranchId,
  BranchOperationResult,
} from "./types";
export { createScenario } from "./create-scenario";
export { createRevision } from "./create-revision";
export type { CreateRevisionResult } from "./create-revision";
export { rebaseChildBranches } from "./rebase-branches";
export { promoteVersion } from "./promote-branch";
export {
  switchToBranch,
  switchToScenario,
  switchToMain,
} from "./switch-scenario";
export { deleteScenario } from "./delete-scenario";
export { renameScenario } from "./rename-scenario";
export { getSimulationForState } from "./get-simulation";

// Helper functions
export {
  getActiveBranch,
  getMainBranch,
  getBranch,
  getScenarios,
  isMainBranch,
  getVersion,
  getHeadVersion,
  getActiveHeadVersion,
  getSnapshot,
  getActiveSnapshot,
  isMainLocked,
  hasDraft,
  activeBranchHasDraft,
} from "./helpers";
