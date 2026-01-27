import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { defaultSplits, splitsAtom } from "src/state/jotai";

export const toggleNetworkReviewShortcut = "ctrl+b";

export const useToggleNetworkReview = () => {
  const setPanelSplits = useSetAtom(splitsAtom);
  const userTracking = useUserTracking();

  const toggleNetworkReview = useCallback(
    ({
      source,
      state,
    }: {
      source: "toolbar" | "shortcut" | "auto";
      state?: boolean;
    }) => {
      setPanelSplits((splits) => {
        const isShown = state !== undefined ? state : !splits.leftOpen;
        if (isShown !== splits.leftOpen) {
          userTracking.capture({
            name: isShown ? "networkReview.opened" : "networkReview.closed",
            source,
          });
        }
        return { ...splits, leftOpen: isShown, left: defaultSplits.left };
      });
    },
    [setPanelSplits, userTracking],
  );

  return toggleNetworkReview;
};
