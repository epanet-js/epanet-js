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
      userTracking.capture({
        name: "networkReview.opened",
        source,
      });
      setPanelSplits((splits) => ({ ...splits, leftOpen: !splits.leftOpen }));
    },
    [setPanelSplits, userTracking],
  );

  return [isActive, toggleNetworkReview];
};
