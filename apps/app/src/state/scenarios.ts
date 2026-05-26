import { atom } from "jotai";
import type { Branch, Worktree } from "src/lib/worktree/types";

const mainBranch: Branch = {
  id: "main",
  name: "Main",
  parentId: null,
  status: "open",
};

export const initialWorktree: Worktree = {
  activeBranchId: "main",
  lastActiveBranchId: "main",
  branches: new Map([["main", mainBranch]]),
  mainId: "main",
  scenarios: [],
  highestScenarioNumber: 0,
};

export const worktreeAtom = atom<Worktree>(initialWorktree);

export const scenariosListAtom = atom((get) => {
  const state = get(worktreeAtom);
  return state.scenarios
    .map((id) => state.branches.get(id))
    .filter((b): b is Branch => b !== undefined);
});

export const hasScenariosAtom = atom((get) => {
  return get(worktreeAtom).scenarios.length > 0;
});

export type { Worktree } from "src/lib/worktree/types";
