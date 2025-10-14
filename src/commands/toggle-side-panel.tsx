import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { defaultSplits, splitsAtom } from "src/state/jotai";

export const toggleSidePanelShortcut = "alt+ctrl+b";

export const useToggleSidePanel = () => {
  const setPanelSplits = useSetAtom(splitsAtom);
  const userTracking = useUserTracking();

  const toggleSidePanel = useCallback(
    ({ source }: { source: "toolbar" | "shortcut" }) => {
      setPanelSplits((splits) => {
        const isShown = !splits.rightOpen;
        userTracking.capture({
          name: isShown ? "sidePanel.opened" : "sidePanel.closed",
          source,
        });
        return { ...splits, rightOpen: isShown, right: defaultSplits.right };
      });
    },
    [setPanelSplits, userTracking],
  );

  return toggleSidePanel;
};
