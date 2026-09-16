import { atom } from "jotai";
import {
  type Bookmark,
  type CollectionKind,
  type SelectionSet,
  initializeBookmarks,
  initializeSelectionSets,
} from "src/lib/collections";

export const selectionSetsAtom = atom<SelectionSet[]>(
  initializeSelectionSets(),
);

export const bookmarksAtom = atom<Bookmark[]>(initializeBookmarks());

export const pendingCollectionDraftAtom = atom<CollectionKind | null>(null);
