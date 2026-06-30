import { atom } from "jotai";
import type { PipeMaterial } from "@epanet-js/pipe-library";

export const pipeMaterialsAtom = atom<PipeMaterial[]>([]);
export const pipeMaterialLabelsAtom = atom((get) =>
  get(pipeMaterialsAtom).map((m) => m.label),
);
export const selectedMaterialLabelAtom = atom<string | null>(null);
