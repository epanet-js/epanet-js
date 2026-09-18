import { nanoid } from "nanoid";
import type { HydraulicModel } from "src/hydraulic-model";
import { USelection } from "src/selection";
import type { Sel } from "src/selection";
import type { BBox, IWrappedFeature } from "src/types";

export type CollectionKind = "selectionSets" | "bookmarks";

export type CollectionDraftSource =
  | "collections-heading"
  | "collections-add-row"
  | "context-menu"
  | "toolbar";

export type CollectionDraft = {
  kind: CollectionKind;
  source: CollectionDraftSource;
};

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

const isContainedBy = (
  members: Sel,
  selectedAssets: ReadonlySet<IWrappedFeature["id"]>,
  selectedCustomerPoints: ReadonlySet<number>,
): boolean =>
  USelection.getAssetIds(members).every((id) => selectedAssets.has(id)) &&
  USelection.getCustomerPointIds(members).every((id) =>
    selectedCustomerPoints.has(id),
  );

export const largestContainedSet = (
  selectionSets: readonly SelectionSet[],
  selection: Sel,
  hydraulicModel: HydraulicModel,
): SelectionSetId | null => {
  const selectedAssets = new Set(USelection.getAssetIds(selection));
  const selectedCustomerPoints = new Set(
    USelection.getCustomerPointIds(selection),
  );
  if (selectedAssets.size + selectedCustomerPoints.size === 0) return null;

  let largest: { id: SelectionSetId; size: number } | null = null;

  for (const selectionSet of selectionSets) {
    const members = existingSelection(selectionSet.selection, hydraulicModel);
    const size = countSelected(members);
    if (size === 0) continue;

    if (
      isContainedBy(members, selectedAssets, selectedCustomerPoints) &&
      (largest === null || size > largest.size)
    ) {
      largest = { id: selectionSet.id, size };
    }
  }

  return largest?.id ?? null;
};

export const matchesSelectionExactly = (
  selectionSet: SelectionSet,
  selection: Sel,
  hydraulicModel: HydraulicModel,
): boolean => {
  const members = existingSelection(selectionSet.selection, hydraulicModel);
  const size = countSelected(members);
  if (size === 0 || size !== countSelected(selection)) return false;

  return isContainedBy(
    members,
    new Set(USelection.getAssetIds(selection)),
    new Set(USelection.getCustomerPointIds(selection)),
  );
};
