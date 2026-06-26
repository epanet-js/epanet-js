import { atom } from "jotai";
import type { PipeMaterial } from "@epanet-js/pipe-library";

export const pipeMaterialsAtom = atom<PipeMaterial[]>([]);
export const selectedMaterialLabelAtom = atom<string | null>(null);
