import { nanoid } from "nanoid";
import type { HydraulicModel } from "src/hydraulic-model";
import { USelection } from "src/selection";
import type { Sel } from "src/selection";
import type { BBox, IWrappedFeature } from "src/types";

export type CollectionKind = "selectionSets" | "bookmarks";

export type CollectionDraftSource =
  | "collections-heading"
  | "collections-group"
  | "collections-add-row"
  | "context-menu"
  | "toolbar"
  | "script-output";

export type CollectionDraft = {
  kind: CollectionKind;
  source: CollectionDraftSource;
  label: string;
  groupId?: SelectionSetGroupId | null;
};

export type SelectionSetId = string;
export type SelectionSetGroupId = string;
export type BookmarkId = string;

export type SelectionSet = {
  id: SelectionSetId;
  label: string;
  selection: Sel;
  groupId: SelectionSetGroupId | null;
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
  groupId: SelectionSetGroupId | null = null,
): SelectionSet => ({
  id: nanoid(),
  label,
  selection: USelection.fromIds(
    USelection.getAssetIds(selection),
    USelection.getCustomerPointIds(selection),
    USelection.getZoneIds(selection),
  ),
  groupId,
});

export const resolveGroupId = (
  groups: readonly SelectionSetGroup[],
  id: SelectionSetGroupId | null,
): SelectionSetGroupId | null =>
  id !== null && groups.some((group) => group.id === id) ? id : null;

export const childGroups = (
  groups: readonly SelectionSetGroup[],
  parentId: SelectionSetGroupId | null,
): SelectionSetGroup[] => groups.filter((group) => group.parentId === parentId);

export const descendantGroupIds = (
  groups: readonly SelectionSetGroup[],
  id: SelectionSetGroupId,
): SelectionSetGroupId[] => {
  const descendants: SelectionSetGroupId[] = [];
  const pending = [id];
  while (pending.length > 0) {
    const parentId = pending.pop()!;
    for (const child of childGroups(groups, parentId)) {
      if (child.id === id || descendants.includes(child.id)) continue;
      descendants.push(child.id);
      pending.push(child.id);
    }
  }
  return descendants;
};

export const ancestorGroupIds = (
  groups: readonly SelectionSetGroup[],
  id: SelectionSetGroupId,
): SelectionSetGroupId[] => {
  const ancestors: SelectionSetGroupId[] = [];
  const visited = new Set<SelectionSetGroupId>([id]);
  let current = groups.find((group) => group.id === id)?.parentId ?? null;
  while (current !== null && !visited.has(current)) {
    visited.add(current);
    ancestors.push(current);
    current = groups.find((group) => group.id === current)?.parentId ?? null;
  }
  return ancestors;
};

export const groupPath = (
  groups: readonly SelectionSetGroup[],
  id: SelectionSetGroupId,
): string[] => {
  const labels: string[] = [];
  const visited = new Set<SelectionSetGroupId>();
  let current: SelectionSetGroupId | null = id;
  while (current !== null && !visited.has(current)) {
    visited.add(current);
    const group = groups.find((candidate) => candidate.id === current);
    if (!group) break;
    labels.unshift(group.label);
    current = group.parentId;
  }
  return labels;
};

export const canMoveGroup = (
  groups: readonly SelectionSetGroup[],
  id: SelectionSetGroupId,
  parentId: SelectionSetGroupId | null,
): boolean => {
  if (parentId === null) return true;
  if (parentId === id) return false;
  if (!groups.some((group) => group.id === parentId)) return false;
  return !descendantGroupIds(groups, id).includes(parentId);
};

export const moveGroup = (
  groups: readonly SelectionSetGroup[],
  id: SelectionSetGroupId,
  parentId: SelectionSetGroupId | null,
): SelectionSetGroup[] =>
  groups.map((group) => (group.id === id ? { ...group, parentId } : group));

export const setsInGroupSubtree = (
  groups: readonly SelectionSetGroup[],
  sets: readonly SelectionSet[],
  id: SelectionSetGroupId,
): SelectionSet[] => {
  const subtree = new Set([id, ...descendantGroupIds(groups, id)]);
  return sets.filter((set) => set.groupId !== null && subtree.has(set.groupId));
};

export const deleteGroupSubtree = (
  groups: readonly SelectionSetGroup[],
  sets: readonly SelectionSet[],
  id: SelectionSetGroupId,
): {
  groups: SelectionSetGroup[];
  sets: SelectionSet[];
  removedGroupIds: SelectionSetGroupId[];
  removedSetIds: SelectionSetId[];
} => {
  const removedGroupIds = [id, ...descendantGroupIds(groups, id)];
  const removed = new Set(removedGroupIds);
  const removedSetIds = sets
    .filter((set) => set.groupId !== null && removed.has(set.groupId))
    .map((set) => set.id);
  const removedSets = new Set(removedSetIds);
  return {
    groups: groups.filter((group) => !removed.has(group.id)),
    sets: sets.filter((set) => !removedSets.has(set.id)),
    removedGroupIds,
    removedSetIds,
  };
};

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
