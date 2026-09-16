import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { useActivatePanel } from "src/commands/activate-panel";
import { useUserTracking } from "src/infra/user-tracking";
import type { CollectionDraft } from "src/lib/collections";
import { COLLECTIONS_PANEL_ID } from "src/panels/collections/create-panel";
import { pendingCollectionDraftAtom } from "src/state/collections";
import { defaultSplits, splitsAtom } from "src/state/layout";
import { panelsIn } from "src/state/panels";

const leftPanelsAtom = panelsIn("left");

export const useIsCollectionsAvailable = (): boolean => {
  const leftPanels = useAtomValue(leftPanelsAtom);
  return leftPanels.some((entry) => entry.id === COLLECTIONS_PANEL_ID);
};

export const useStartCollectionDraft = () => {
  const setSplits = useSetAtom(splitsAtom);
  const setPendingDraft = useSetAtom(pendingCollectionDraftAtom);
  const activatePanel = useActivatePanel();
  const userTracking = useUserTracking();

  return useCallback(
    ({ kind, source }: CollectionDraft) => {
      if (kind === "selectionSets") {
        userTracking.capture({ name: "selectionSet.draftStarted", source });
      } else {
        userTracking.capture({ name: "bookmark.draftStarted", source });
      }
      setSplits((splits) =>
        splits.leftOpen
          ? splits
          : { ...splits, leftOpen: true, left: defaultSplits.left },
      );
      activatePanel(COLLECTIONS_PANEL_ID);
      setPendingDraft({ kind, source });
    },
    [setSplits, setPendingDraft, activatePanel, userTracking],
  );
};
