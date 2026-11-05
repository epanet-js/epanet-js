import { useAtomCallback } from "jotai/utils";
import type { LngLatBoundsLike } from "mapbox-gl";
import { useCallback, useContext } from "react";
import {
  useRevealCollectionsPanel,
  useStartCollectionDraft,
} from "src/commands/collection-draft";
import { useFeatureLock } from "src/components/form/paywall";
import { useBookmarksTransaction } from "src/hooks/persistence/use-bookmarks-transaction";
import { useSelectionSetsTransaction } from "src/hooks/persistence/use-selection-sets-transaction";
import { usePermissions } from "src/hooks/use-permissions";
import { useZoomTo } from "src/hooks/use-zoom-to";
import { useUserTracking } from "src/infra/user-tracking";
import type {
  ScriptBookmark,
  ScriptOutputBookmark,
  ScriptOutputSelectionSet,
  ScriptSelectionSet,
} from "src/lib/scripting";
import {
  countSelected,
  existingSelection,
  newBookmark,
  newSelectionSet,
} from "src/lib/collections";
import { MapContext } from "src/map";
import { USelection } from "src/selection";
import { bookmarksAtom, selectionSetsAtom } from "src/state/collections";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";

export const useApplyScriptSelectionSet = () => {
  const zoomTo = useZoomTo();

  return useAtomCallback(
    useCallback(
      (get, set, { targets }: ScriptSelectionSet) => {
        const selection = existingSelection(
          USelection.fromIds(targets.assetIds, targets.customerPointIds),
          get(stagingModelDerivedAtom),
        );
        set(selectionAtom, selection);
        zoomTo(selection);
      },
      [zoomTo],
    ),
  );
};

export const useSaveScriptSelectionSet = () => {
  const applySelectionSet = useApplyScriptSelectionSet();
  const startCollectionDraft = useStartCollectionDraft();

  return useCallback(
    (selectionSet: ScriptSelectionSet) => {
      applySelectionSet(selectionSet);
      startCollectionDraft({
        kind: "selectionSets",
        source: "script-output",
        label: selectionSet.label,
      });
    },
    [applySelectionSet, startCollectionDraft],
  );
};

export const useSaveScriptBookmark = () => {
  const goToBookmark = useGoToScriptBookmark();
  const startCollectionDraft = useStartCollectionDraft();

  return useCallback(
    (bookmark: ScriptBookmark) => {
      goToBookmark(bookmark);
      startCollectionDraft({
        kind: "bookmarks",
        source: "script-output",
        label: bookmark.label,
      });
    },
    [goToBookmark, startCollectionDraft],
  );
};

export const useGoToScriptBookmark = () => {
  const map = useContext(MapContext);

  return useCallback(
    ({ bbox }: ScriptBookmark) => {
      map?.map.fitBounds(bbox as LngLatBoundsLike, {
        padding: 0,
        animate: false,
      });
    },
    [map],
  );
};

export const useSaveAllScriptSelectionSets = () => {
  const userTracking = useUserTracking();
  const { create } = useSelectionSetsTransaction();
  const { canManageCollections } = usePermissions();
  const { openPaywall } = useFeatureLock("selectionSets");
  const revealPanel = useRevealCollectionsPanel();

  return useAtomCallback(
    useCallback(
      (get, _set, selectionSets: ScriptOutputSelectionSet[]) => {
        if (!canManageCollections) return openPaywall();

        const model = get(stagingModelDerivedAtom);
        for (const { label, targets, commit } of selectionSets) {
          if (commit) continue;
          const selection = existingSelection(
            USelection.fromIds(targets.assetIds, targets.customerPointIds),
            model,
          );
          const count = countSelected(selection);
          if (count === 0) continue;
          if (!create(newSelectionSet(label, selection))) return;

          userTracking.capture({
            name: "selectionSet.created",
            count,
            totalSets: get(selectionSetsAtom).length,
            inGroup: false,
            source: "script-output",
          });
        }
        revealPanel();
      },
      [canManageCollections, openPaywall, create, userTracking, revealPanel],
    ),
  );
};

export const useSaveAllScriptBookmarks = () => {
  const userTracking = useUserTracking();
  const { transact } = useBookmarksTransaction();
  const { canManageCollections } = usePermissions();
  const { openPaywall } = useFeatureLock("selectionSets");
  const revealPanel = useRevealCollectionsPanel();

  return useAtomCallback(
    useCallback(
      (get, _set, bookmarks: ScriptOutputBookmark[]) => {
        if (!canManageCollections) return openPaywall();

        const unsaved = bookmarks.filter(({ commit }) => !commit);
        if (unsaved.length === 0) return;

        const allBookmarks = [
          ...get(bookmarksAtom),
          ...unsaved.map(({ label, bbox }) => newBookmark(label, bbox)),
        ];
        if (!transact(allBookmarks)) return;

        unsaved.forEach(() =>
          userTracking.capture({
            name: "bookmark.created",
            totalBookmarks: allBookmarks.length,
            source: "script-output",
          }),
        );
        revealPanel();
      },
      [canManageCollections, openPaywall, transact, userTracking, revealPanel],
    ),
  );
};
