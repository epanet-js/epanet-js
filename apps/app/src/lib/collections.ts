import { nanoid } from "nanoid";
import type { HydraulicModel } from "src/hydraulic-model";
import { USelection } from "src/selection";
import type { Sel } from "src/selection";
import type { BBox } from "src/types";

export type CollectionKind = "selectionSets" | "bookmarks";

export type SelectionSetId = string;
export type BookmarkId = string;

export type SelectionSet = {
  id: SelectionSetId;
  name: string;
  selection: Sel;
};

export type Bookmark = {
  id: BookmarkId;
  name: string;
  bbox: BBox;
};

export const initializeSelectionSets = (): SelectionSet[] => [];

export const initializeBookmarks = (): Bookmark[] => [];

export const newSelectionSet = (
  name: string,
  selection: Sel,
): SelectionSet => ({
  id: nanoid(),
  name,
  selection,
});

export const newBookmark = (name: string, bbox: BBox): Bookmark => ({
  id: nanoid(),
  name,
  bbox,
});

type Named = { id: string; name: string };

export const renameItem = <T extends Named>(
  items: readonly T[],
  id: string,
  name: string,
): T[] => items.map((item) => (item.id === id ? { ...item, name } : item));

export const removeItem = <T extends Named>(
  items: readonly T[],
  id: string,
): T[] => items.filter((item) => item.id !== id);

export const countSelected = (selection: Sel): number => {
  const { assets, customerPoints } = USelection.countByKind(selection);
  return assets + customerPoints;
};

export const existingSelection = (
  selection: Sel,
  hydraulicModel: HydraulicModel,
): Sel =>
  USelection.fromIds(
    USelection.getAssetIds(selection).filter((id) =>
      hydraulicModel.assets.has(id),
    ),
    USelection.getCustomerPointIds(selection).filter((id) =>
      hydraulicModel.customerPoints.has(id),
    ),
  );
