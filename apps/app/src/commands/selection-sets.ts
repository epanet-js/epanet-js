import { useAtomCallback } from "jotai/utils";
import { useCallback } from "react";
import { useZoomTo } from "src/hooks/use-zoom-to";
import { useUserTracking } from "src/infra/user-tracking";
import { useFeatureLock } from "src/components/form/paywall";
import { usePermissions } from "src/hooks/use-permissions";
import {
  type CollectionDraftSource,
  type SelectionSetId,
  countSelected,
  existingSelection,
  newSelectionSet,
} from "src/lib/collections";
import { useSelectionSetsTransaction } from "src/hooks/persistence/use-selection-sets-transaction";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";
import { selectionSetsAtom } from "src/state/collections";

export const MIN_SELECTION_SET_SIZE = 1;

export const useSaveSelectionSet = () => {
  const userTracking = useUserTracking();
  const { create } = useSelectionSetsTransaction();

  return useAtomCallback(
    useCallback(
      (
        get,
        _set,
        { label, source }: { label: string; source: CollectionDraftSource },
      ) => {
        const selection = get(selectionAtom);
        const count = countSelected(selection);
        if (count < MIN_SELECTION_SET_SIZE) return;

        if (!create(newSelectionSet(label, selection))) return;

        userTracking.capture({
          name: "selectionSet.created",
          count,
          totalSets: get(selectionSetsAtom).length,
          source,
        });
      },
      [userTracking, create],
    ),
  );
};

export const useApplySelectionSet = () => {
  const zoomTo = useZoomTo();
  const userTracking = useUserTracking();

  return useAtomCallback(
    useCallback(
      (
        get,
        set,
        {
          setId,
          zoom,
          source,
        }: { setId: SelectionSetId; zoom: boolean; source: "panel" },
      ) => {
        const selectionSet = get(selectionSetsAtom).find(
          (candidate) => candidate.id === setId,
        );
        if (!selectionSet) return;

        const selection = existingSelection(
          selectionSet.selection,
          get(stagingModelDerivedAtom),
        );
        const count = countSelected(selection);

        userTracking.capture({
          name: "selectionSet.applied",
          count,
          missing: countSelected(selectionSet.selection) - count,
          zoom,
          source,
        });
        set(selectionAtom, selection);
        if (zoom) zoomTo(selection);
      },
      [zoomTo, userTracking],
    ),
  );
};

export const useRenameSelectionSet = () => {
  const userTracking = useUserTracking();
  const { rename } = useSelectionSetsTransaction();
  const { canManageCollections } = usePermissions();
  const { openPaywall } = useFeatureLock("selectionSets");

  return useCallback(
    ({
      setId,
      label,
      source,
    }: {
      setId: SelectionSetId;
      label: string;
      source: "panel";
    }) => {
      if (!canManageCollections) return openPaywall();
      if (!rename({ id: setId, label })) return;

      userTracking.capture({ name: "selectionSet.renamed", source });
    },
    [userTracking, rename, canManageCollections, openPaywall],
  );
};

export const useDeleteSelectionSet = () => {
  const userTracking = useUserTracking();
  const { remove } = useSelectionSetsTransaction();
  const { canManageCollections } = usePermissions();
  const { openPaywall } = useFeatureLock("selectionSets");

  return useCallback(
    ({ setId, source }: { setId: SelectionSetId; source: "panel" }) => {
      if (!canManageCollections) return openPaywall();

      userTracking.capture({ name: "selectionSet.deleted", source });
      remove(setId);
    },
    [userTracking, remove, canManageCollections, openPaywall],
  );
};
