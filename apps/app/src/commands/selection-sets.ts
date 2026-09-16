import { useAtomCallback } from "jotai/utils";
import { useCallback } from "react";
import { useZoomTo } from "src/hooks/use-zoom-to";
import { useUserTracking } from "src/infra/user-tracking";
import {
  type CollectionDraftSource,
  type SelectionSetId,
  countSelected,
  existingSelection,
  newSelectionSet,
  removeItem,
  renameItem,
} from "src/lib/collections";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";
import { selectionSetsAtom } from "src/state/collections";

export const MIN_SELECTION_SET_SIZE = 1;

export const useSaveSelectionSet = () => {
  const userTracking = useUserTracking();

  return useAtomCallback(
    useCallback(
      (
        get,
        set,
        { name, source }: { name: string; source: CollectionDraftSource },
      ) => {
        const selection = get(selectionAtom);
        const count = countSelected(selection);
        if (count < MIN_SELECTION_SET_SIZE) return;

        userTracking.capture({
          name: "selectionSet.created",
          count,
          totalSets: get(selectionSetsAtom).length + 1,
          source,
        });
        set(selectionSetsAtom, (sets) => [
          ...sets,
          newSelectionSet(name, selection),
        ]);
      },
      [userTracking],
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

  return useAtomCallback(
    useCallback(
      (
        _get,
        set,
        {
          setId,
          name,
          source,
        }: { setId: SelectionSetId; name: string; source: "panel" },
      ) => {
        userTracking.capture({ name: "selectionSet.renamed", source });
        set(selectionSetsAtom, (sets) => renameItem(sets, setId, name));
      },
      [userTracking],
    ),
  );
};

export const useDeleteSelectionSet = () => {
  const userTracking = useUserTracking();

  return useAtomCallback(
    useCallback(
      (
        _get,
        set,
        { setId, source }: { setId: SelectionSetId; source: "panel" },
      ) => {
        userTracking.capture({ name: "selectionSet.deleted", source });
        set(selectionSetsAtom, (sets) => removeItem(sets, setId));
      },
      [userTracking],
    ),
  );
};
