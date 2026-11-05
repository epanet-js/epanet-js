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
  | "toolbar"
  | "script-output";

export type CollectionDraft = {
  kind: CollectionKind;
  source: CollectionDraftSource;
  label: string;
};

export type SelectionSetId = string;
export type SelectionSetGroupId = string;
export type BookmarkId = string;

export type SelectionSet = {
  id: SelectionSetId;
  label: string;
  selection: Sel;
};

export type SelectionSetGroup = {
  id: SelectionSetGroupId;
  label: string;
  parentId: SelectionSetGroupId | null;
};

export type Bookmark = {
  id: BookmarkId;
  label: string;
  bbox: BBox;
};

export const initializeSelectionSets = (): SelectionSet[] => [];

export const initializeSelectionSetGroups = (): SelectionSetGroup[] => [];

export const initializeBookmarks = (): Bookmark[] => [];

export const newSelectionSet = (
  label: string,
  selection: Sel,
): SelectionSet => ({
  id: nanoid(),
  label,
  selection: USelection.fromIds(
    USelection.getAssetIds(selection),
    USelection.getCustomerPointIds(selection),
    USelection.getZoneIds(selection),
  ),
});

export const savableSelection = (selection: Sel, includeZones: boolean): Sel =>
  includeZones
    ? selection
    : USelection.fromIds(
        USelection.getAssetIds(selection),
        USelection.getCustomerPointIds(selection),
      );

export const newSelectionSetGroup = (
  label: string,
  parentId: SelectionSetGroupId | null = null,
): SelectionSetGroup => ({
  id: nanoid(),
  label,
  parentId,
});

export const newBookmark = (label: string, bbox: BBox): Bookmark => ({
  id: nanoid(),
  label,
  bbox,
});

type Labeled = { id: string; label: string };

export const renameItem = <T extends Labeled>(
  items: readonly T[],
  id: string,
  label: string,
): T[] => items.map((item) => (item.id === id ? { ...item, label } : item));

export const removeItem = <T extends Labeled>(
  items: readonly T[],
  id: string,
): T[] => items.filter((item) => item.id !== id);

export const countSelected = (selection: Sel): number => {
  const { assets, customerPoints, zones } = USelection.countByKind(selection);
  return assets + customerPoints + zones;
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
    USelection.getZoneIds(selection).filter((id) =>
      hydraulicModel.zones.has(id),
    ),
  );

const isContainedBy = (
  members: Sel,
  selectedAssets: ReadonlySet<IWrappedFeature["id"]>,
  selectedCustomerPoints: ReadonlySet<number>,
  selectedZones: ReadonlySet<number>,
): boolean =>
  USelection.getAssetIds(members).every((id) => selectedAssets.has(id)) &&
  USelection.getCustomerPointIds(members).every((id) =>
    selectedCustomerPoints.has(id),
  ) &&
  USelection.getZoneIds(members).every((id) => selectedZones.has(id));

export const largestContainedSet = (
  selectionSets: readonly SelectionSet[],
  selection: Sel,
  hydraulicModel: HydraulicModel,
): SelectionSetId | null => {
  const selectedAssets = new Set(USelection.getAssetIds(selection));
  const selectedCustomerPoints = new Set(
    USelection.getCustomerPointIds(selection),
  );
  const selectedZones = new Set(USelection.getZoneIds(selection));
  if (
    selectedAssets.size + selectedCustomerPoints.size + selectedZones.size ===
    0
  )
    return null;

  let largest: { id: SelectionSetId; size: number } | null = null;

  for (const selectionSet of selectionSets) {
    const members = existingSelection(selectionSet.selection, hydraulicModel);
    const size = countSelected(members);
    if (size === 0) continue;

    if (
      isContainedBy(
        members,
        selectedAssets,
        selectedCustomerPoints,
        selectedZones,
      ) &&
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
    new Set(USelection.getZoneIds(selection)),
  );
};
