import { atom } from "jotai";
import type { Setter } from "jotai";
import { nanoid } from "nanoid";
import type { Worktree } from "@epanet-js/worktree";
import {
  branchStateAtom,
  type BranchState,
  type UnloadedBranchState,
} from "src/state/branch-state";
import { worktreeAtom } from "src/state/scenarios";

export const buildProjectRevision = (
  dataVersion: string,
  worktree: Worktree,
  branchStates: Map<string, BranchState | UnloadedBranchState>,
): string => {
  const branches = [...worktree.branches.values()]
    .map((branch) => {
      const state = branchStates.get(branch.id);
      return `${branch.id}=${branch.name}:${state?.version}:${state?.simulationSettings.version}`;
    })
    .sort();
  return [dataVersion, ...branches].join("|");
};

export const projectDataVersionAtom = atom<string>(nanoid());

export const projectRevisionAtom = atom<string>((get) =>
  buildProjectRevision(
    get(projectDataVersionAtom),
    get(worktreeAtom),
    get(branchStateAtom),
  ),
);

export const savedProjectRevisionAtom = atom<string | null>(null);

export const hasUnsavedChangesRevisionAtom = atom<boolean>((get) => {
  const savedRevision = get(savedProjectRevisionAtom);
  if (savedRevision === null) return true;

  return savedRevision !== get(projectRevisionAtom);
});

export const markProjectSavedAtom = atom(null, (get, set) => {
  set(savedProjectRevisionAtom, get(projectRevisionAtom));
});

export const markProjectUnsavedAtom = atom(null, (_get, set) => {
  set(savedProjectRevisionAtom, null);
});

export const resetProjectRevision = (
  set: Setter,
  worktree: Worktree,
  branchStates: Map<string, BranchState | UnloadedBranchState>,
): void => {
  const dataVersion = nanoid();
  set(projectDataVersionAtom, dataVersion);
  set(
    savedProjectRevisionAtom,
    buildProjectRevision(dataVersion, worktree, branchStates),
  );
};
