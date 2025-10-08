import { useAtom } from "jotai";
import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { splitsAtom } from "src/state/jotai";

export const toggleNetworkReviewShortcut = "ctrl+b";

export const useToggleNetworkReview = (): [
  boolean,
  ({ source }: { source: "toolbar" | "shortcut" }) => void,
] => {
  const [{ leftOpen: isActive }, setPanelSplits] = useAtom(splitsAtom);
  const userTracking = useUserTracking();

  const toggleNetworkReview = useCallback(
    ({ source }: { source: "toolbar" | "shortcut" }) => {
      setPanelSplits((splits) => {
        const isShown = !splits.leftOpen;
        userTracking.capture({
          name: isShown ? "networkReview.opened" : "networkReview.closed",
          source,
        });
        return { ...splits, leftOpen: isShown };
      });
    },
    [setPanelSplits, userTracking],
  );

  return [isActive, toggleNetworkReview];
};
