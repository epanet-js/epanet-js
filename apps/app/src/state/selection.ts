import { atom } from "jotai";
import type { Sel } from "src/selection";

export const selectionAtom = atom<Sel>({ asset: [], customerPoint: [] });
