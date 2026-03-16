import { atom } from "jotai";
import type { Sel } from "src/selection/types";
import { FolderMap } from "src/types";

/**
 * Core data
 */
export interface Data {
  folderMap: FolderMap;
  selection: Sel;
}

export const nullData: Data = {
  folderMap: new Map(),
  selection: {
    type: "none",
  },
};
export const dataAtom = atom<Data>(nullData);
