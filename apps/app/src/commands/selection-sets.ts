import { useAtomCallback } from "jotai/utils";
import { useCallback } from "react";
import { useZoomTo } from "src/hooks/use-zoom-to";
import { useUserTracking } from "src/infra/user-tracking";
import { useFeatureLock } from "src/components/form/paywall";
import { usePermissions } from "src/hooks/use-permissions";
import {
  type CollectionDraftSource,
  type SelectionSetGroupId,
  type SelectionSetId,
  SET_PATH_SEPARATOR,
  countSelected,
  existingSelection,
  newSelectionSet,
  splitSetPath,
} from "src/lib/collections";
import type { Sel } from "src/selection";
import { useEnsureSelectionSetGroupPath } from "src/commands/selection-set-groups";
import { useSelectionSetsTransaction } from "src/hooks/persistence/use-selection-sets-transaction";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";
import { selectionSetsAtom } from "src/state/collections";

export const MIN_SELECTION_SET_SIZE = 1;

export const useCreateSelectionSet = () => {
  const userTracking = useUserTracking();
  const { create } = useSelectionSetsTransaction();
  const ensureGroupPath = useEnsureSelectionSetGroupPath();

  return useAtomCallback(
    useCallback(
      (
        get,
        _set,
        {
          label: name,
          selection,
          source,
          groupId: parentId = null,
          groupLabels: outerGroupLabels = [],
        }: {
          label: string;
          selection: Sel;
          source: CollectionDraftSource;
          groupId?: SelectionSetGroupId | null;
          groupLabels?: string[];
        },
      ): "created" | "skipped" | "failed" => {
        const count = countSelected(selection);
        if (count < MIN_SELECTION_SET_SIZE) return "skipped";

        const { groupLabels, label } = name.includes(SET_PATH_SEPARATOR)
          ? splitSetPath(name)
          : { groupLabels: [], label: name };
        if (!label) return "skipped";

        const ensured = ensureGroupPath({
          groupLabels: [...outerGroupLabels, ...groupLabels],
          parentId,
          source: source === "script-output" ? "script-output" : "panel",
        });
        if (!ensured) return "failed";
        const { groupId } = ensured;

        if (!create(newSelectionSet(label, selection, groupId)))
          return "failed";

        userTracking.capture({
          name: "selectionSet.created",
          count,
          totalSets: get(selectionSetsAtom).length,
          inGroup: groupId !== null,
          source,
        });
        return "created";
      },
      [userTracking, create, ensureGroupPath],
    ),
  );
};

export const useSaveSelectionSet = () => {
  const createSelectionSet = useCreateSelectionSet();

  return useAtomCallback(
    useCallback(
      (
        get,
        _set,
        input: {
          label: string;
          source: CollectionDraftSource;
          groupId?: SelectionSetGroupId | null;
          groupLabels?: string[];
        },
      ) => {
        createSelectionSet({ ...input, selection: get(selectionAtom) });
      },
      [createSelectionSet],
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

export const useMoveSelectionSet = () => {
  const userTracking = useUserTracking();
  const { move } = useSelectionSetsTransaction();
  const { canManageCollections } = usePermissions();
  const { openPaywall } = useFeatureLock("selectionSets");

  return useCallback(
    ({
      setId,
      groupId,
      source,
    }: {
      setId: SelectionSetId;
      groupId: SelectionSetGroupId | null;
      source: "panel";
    }) => {
      if (!canManageCollections) return openPaywall();
      if (!move({ id: setId, groupId })) return;

      userTracking.capture({ name: "selectionSet.moved", source });
    },
    [userTracking, move, canManageCollections, openPaywall],
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
