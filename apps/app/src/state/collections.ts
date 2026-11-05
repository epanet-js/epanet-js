import { atom } from "jotai";
import {
  type Bookmark,
  type CollectionDraft,
  type SelectionSet,
  type SelectionSetGroup,
  initializeBookmarks,
  initializeSelectionSetGroups,
  initializeSelectionSets,
} from "src/lib/collections";

export const selectionSetsAtom = atom<SelectionSet[]>(
  initializeSelectionSets(),
);

export const selectionSetGroupsAtom = atom<SelectionSetGroup[]>(
  initializeSelectionSetGroups(),
);

export const bookmarksAtom = atom<Bookmark[]>(initializeBookmarks());

export const pendingCollectionDraftAtom = atom<CollectionDraft | null>(null);
