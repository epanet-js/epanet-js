import { atom } from "jotai";
import {
  initializeWorktree,
  type Branch,
  type Worktree,
} from "@epanet-js/worktree";

export const worktreeAtom = atom<Worktree>(initializeWorktree());

export const scenariosListAtom = atom((get) => {
  const state = get(worktreeAtom);
  return state.scenarios
    .map((id) => state.branches.get(id))
    .filter((b): b is Branch => b !== undefined);
});

export const hasScenariosAtom = atom((get) => {
  return get(worktreeAtom).scenarios.length > 0;
});

export type { Worktree } from "@epanet-js/worktree";
