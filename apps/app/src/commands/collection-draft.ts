import { useSetAtom } from "jotai";
import { useAtomCallback } from "jotai/utils";
import { useCallback } from "react";
import { useActivatePanel } from "src/commands/activate-panel";
import { useFeatureLock } from "src/components/form/paywall";
import { usePermissions } from "src/hooks/use-permissions";
import { useUserTracking } from "src/infra/user-tracking";
import type { CollectionDraft } from "src/lib/collections";
import { COLLECTIONS_PANEL_ID } from "src/panels/collections/create-panel";
import { pendingCollectionDraftAtom } from "src/state/collections";
import { defaultSplits, splitsAtom } from "src/state/layout";
import { activePanelIn } from "src/state/panels";

const activeLeftPanelAtom = activePanelIn("left");

export const useRevealCollectionsPanel = () => {
  const setSplits = useSetAtom(splitsAtom);
  const activatePanel = useActivatePanel();

  return useCallback(() => {
    setSplits((splits) =>
      splits.leftOpen
        ? splits
        : { ...splits, leftOpen: true, left: defaultSplits.left },
    );
    activatePanel(COLLECTIONS_PANEL_ID);
  }, [setSplits, activatePanel]);
};

export const useStartCollectionDraft = () => {
  const revealPanel = useRevealCollectionsPanel();
  const userTracking = useUserTracking();
  const { canManageCollections } = usePermissions();
  const { openPaywall } = useFeatureLock("selectionSets");

  return useAtomCallback(
    useCallback(
      (get, set, draft: CollectionDraft) => {
        const { kind, source } = draft;
        if (kind === "selectionSets") {
          userTracking.capture({
            name: "selectionSet.draftStarted",
            source,
            canManageCollections,
          });
        } else {
          userTracking.capture({
            name: "bookmark.draftStarted",
            source,
            canManageCollections,
          });
        }

        if (!canManageCollections) {
          const isPanelOnScreen =
            get(splitsAtom).leftOpen &&
            get(activeLeftPanelAtom)?.id === COLLECTIONS_PANEL_ID;

          if (isPanelOnScreen) return openPaywall();

          revealPanel();
          return;
        }

        revealPanel();
        set(pendingCollectionDraftAtom, draft);
      },
      [revealPanel, userTracking, canManageCollections, openPaywall],
    ),
  );
};
