import { atom } from "jotai";
import type { PipeMaterial } from "src/lib/pipe-library";

export const pipeMaterialsAtom = atom<PipeMaterial[]>([]);
export const selectedMaterialLabelAtom = atom<string | null>(null);
