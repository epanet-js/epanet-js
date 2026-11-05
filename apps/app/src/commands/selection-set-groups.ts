import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import { useUserTracking } from "src/infra/user-tracking";
import { useFeatureLock } from "src/components/form/paywall";
import { usePermissions } from "src/hooks/use-permissions";
import {
  type SelectionSetGroup,
  type SelectionSetGroupId,
  descendantGroupIds,
  newSelectionSetGroup,
  setsInGroupSubtree,
} from "src/lib/collections";
import { useSelectionSetGroupsTransaction } from "src/hooks/persistence/use-selection-set-groups-transaction";
import {
  selectionSetGroupsAtom,
  selectionSetsAtom,
} from "src/state/collections";

const depthOf = (
  groups: readonly SelectionSetGroup[],
  parentId: SelectionSetGroupId | null,
): number => {
  let depth = 0;
  let current = parentId;
  while (current !== null && depth < groups.length) {
    depth += 1;
    current = groups.find((group) => group.id === current)?.parentId ?? null;
  }
  return depth;
};

export const useCreateSelectionSetGroup = () => {
  const userTracking = useUserTracking();
  const { create } = useSelectionSetGroupsTransaction();
  const { canManageCollections } = usePermissions();
  const { openPaywall } = useFeatureLock("selectionSets");

  return useAtomCallback(
    useCallback(
      (
        get,
        _set,
        {
          label,
          parentId,
          source,
        }: {
          label: string;
          parentId: SelectionSetGroupId | null;
          source: "panel";
        },
      ) => {
        if (!canManageCollections) return openPaywall();
        if (!create(newSelectionSetGroup(label, parentId))) return;

        const groups = get(selectionSetGroupsAtom);
        userTracking.capture({
          name: "selectionSetGroup.created",
          depth: depthOf(groups, parentId),
          totalGroups: groups.length,
          source,
        });
      },
      [userTracking, create, canManageCollections, openPaywall],
    ),
  );
};

export const useDeleteSelectionSetGroup = () => {
  const userTracking = useUserTracking();
  const { remove } = useSelectionSetGroupsTransaction();
  const { canManageCollections } = usePermissions();
  const { openPaywall } = useFeatureLock("selectionSets");

  return useAtomCallback(
    useCallback(
      (
        get,
        _set,
        { groupId, source }: { groupId: SelectionSetGroupId; source: "panel" },
      ) => {
        if (!canManageCollections) return openPaywall();

        const groups = get(selectionSetGroupsAtom);
        userTracking.capture({
          name: "selectionSetGroup.deleted",
          sets: setsInGroupSubtree(groups, get(selectionSetsAtom), groupId)
            .length,
          subgroups: descendantGroupIds(groups, groupId).length,
          source,
        });
        remove(groupId);
      },
      [userTracking, remove, canManageCollections, openPaywall],
    ),
  );
};
