import { atom } from "jotai";
import type { Sel } from "src/selection";

/**
 * Core data
 */
export interface Data {
  selection: Sel;
}

export const nullData: Data = {
  selection: { type: "none" },
};
export const dataAtom = atom<Data>(nullData);
