import { atom } from "jotai";
import { USelection } from "src/selection";
import type { Sel } from "src/selection";

export const selectionAtom = atom<Sel>(USelection.none());
