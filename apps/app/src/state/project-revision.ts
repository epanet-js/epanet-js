import { atom } from "jotai";
import type { Setter } from "jotai";
import { nanoid } from "nanoid";
import type { Worktree } from "@epanet-js/worktree";
import { baseModelDerivedAtom } from "src/state/derived-branch-state";
import { branchStateAtom, type BranchState } from "src/state/branch-state";
import { worktreeAtom } from "src/state/scenarios";

const buildRevisionDeprecated = (
  modelVersion: string,
  dataVersion: string,
): string => `${modelVersion}:${dataVersion}`;

export const buildProjectRevision = (
  dataVersion: string,
  worktree: Worktree,
  branchStates: Map<string, BranchState>,
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

export const projectRevisionDeprecatedAtom = atom<string>((get) => {
  return buildRevisionDeprecated(
    get(baseModelDerivedAtom).version,
    get(projectDataVersionAtom),
  );
});

export const savedProjectRevisionAtom = atom<string | null>(null);

export const savedProjectRevisionDeprecatedAtom = atom<string | null>(null);

export const hasUnsavedChangesRevisionAtom = atom<boolean>((get) => {
  const savedRevision = get(savedProjectRevisionAtom);
  if (savedRevision === null) return true;

  return savedRevision !== get(projectRevisionAtom);
});

export const hasUnsavedChangesRevisionDeprecatedAtom = atom<boolean>((get) => {
  const savedRevision = get(savedProjectRevisionDeprecatedAtom);
  if (savedRevision === null) return true;

  return savedRevision !== get(projectRevisionDeprecatedAtom);
});

export const markProjectSavedAtom = atom(null, (get, set) => {
  set(savedProjectRevisionAtom, get(projectRevisionAtom));
  set(savedProjectRevisionDeprecatedAtom, get(projectRevisionDeprecatedAtom));
});

export const markProjectUnsavedAtom = atom(null, (_get, set) => {
  set(savedProjectRevisionAtom, null);
  set(savedProjectRevisionDeprecatedAtom, null);
});

export const resetProjectRevision = (
  set: Setter,
  worktree: Worktree,
  branchStates: Map<string, BranchState>,
): void => {
  const dataVersion = nanoid();
  const mainVersion = branchStates.get(worktree.mainId)?.version ?? "";
  set(projectDataVersionAtom, dataVersion);
  set(
    savedProjectRevisionAtom,
    buildProjectRevision(dataVersion, worktree, branchStates),
  );
  set(
    savedProjectRevisionDeprecatedAtom,
    buildRevisionDeprecated(mainVersion, dataVersion),
  );
};
