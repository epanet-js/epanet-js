import { atom } from "jotai";
import type { PipeMaterial } from "src/dialogs/pipe-library/types";

export const pipeMaterialsAtom = atom<PipeMaterial[]>([]);
export const selectedMaterialLabelAtom = atom<string | null>(null);
