import { atom } from "jotai";
import {
  type Bookmark,
  type CollectionDraft,
  type SelectionSet,
  initializeBookmarks,
  initializeSelectionSets,
} from "src/lib/collections";

export const selectionSetsAtom = atom<SelectionSet[]>(
  initializeSelectionSets(),
);

export const bookmarksAtom = atom<Bookmark[]>(initializeBookmarks());

export const pendingCollectionDraftAtom = atom<CollectionDraft | null>(null);
