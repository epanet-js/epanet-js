import { atom } from "jotai";
import { MomentLog } from "src/lib/persistence/moment-log";
import { initialSimulationState } from "src/state/jotai";
import { nullHydraulicModel } from "src/state/hydraulic-model";
import type {
  Worktree,
  Branch,
  Version,
  Snapshot,
} from "src/lib/worktree/types";
import { getScenarios } from "src/lib/worktree/helpers";

const MAIN_BRANCH_ID = "main";
const INITIAL_VERSION_ID = "main-v0";

const initialSnapshot: Snapshot = {
  versionId: INITIAL_VERSION_ID,
  hydraulicModel: nullHydraulicModel,
};

const initialVersion: Version = {
  id: INITIAL_VERSION_ID,
  message: "",
  deltas: [],
  parentId: null,
  status: "draft",
  timestamp: Date.now(),
  snapshot: initialSnapshot,
};

const initialMainBranch: Branch = {
  id: MAIN_BRANCH_ID,
  name: "Main",
  headRevisionId: INITIAL_VERSION_ID,
  simulation: initialSimulationState,
  sessionHistory: new MomentLog(),
  draftVersionId: INITIAL_VERSION_ID,
};

export const initialWorktree: Worktree = {
  activeBranchId: MAIN_BRANCH_ID,
  lastActiveBranchId: MAIN_BRANCH_ID,
  branches: new Map([[MAIN_BRANCH_ID, initialMainBranch]]),
  versions: new Map([[INITIAL_VERSION_ID, initialVersion]]),
  highestScenarioNumber: 0,
};

export const worktreeAtom = atom<Worktree>(initialWorktree);

export const scenariosListAtom = atom((get) => {
  const state = get(worktreeAtom);
  return getScenarios(state);
});

export type {
  Worktree,
  Snapshot,
  Branch,
  Version,
} from "src/lib/worktree/types";
