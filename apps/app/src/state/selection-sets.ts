import { atom } from "jotai";
import {
  type Bookmark,
  type SelectionSet,
  initializeBookmarks,
  initializeSelectionSets,
} from "src/lib/selection-sets";

export const selectionSetsAtom = atom<SelectionSet[]>(
  initializeSelectionSets(),
);

export const bookmarksAtom = atom<Bookmark[]>(initializeBookmarks());
