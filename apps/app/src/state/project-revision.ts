import { atom } from "jotai";
import type { Setter } from "jotai";
import { nanoid } from "nanoid";
import { baseModelDerivedAtom } from "src/state/derived-branch-state";

const buildRevision = (modelVersion: string, dataVersion: string): string =>
  `${modelVersion}:${dataVersion}`;

export const projectDataVersionAtom = atom<string>(nanoid());

export const projectRevisionAtom = atom<string>((get) => {
  return buildRevision(
    get(baseModelDerivedAtom).version,
    get(projectDataVersionAtom),
  );
});

export const savedProjectRevisionAtom = atom<string | null>(null);

export const hasUnsavedChangesRevisionAtom = atom<boolean>((get) => {
  const savedRevision = get(savedProjectRevisionAtom);
  if (savedRevision === null) return true;

  return savedRevision !== get(projectRevisionAtom);
});

export const resetProjectRevision = (
  set: Setter,
  modelVersion: string,
): void => {
  const dataVersion = nanoid();
  set(projectDataVersionAtom, dataVersion);
  set(savedProjectRevisionAtom, buildRevision(modelVersion, dataVersion));
};
