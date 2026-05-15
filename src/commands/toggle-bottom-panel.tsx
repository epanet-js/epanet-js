import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { useExitProfileViewMode } from "src/commands/exit-profile-view-mode";
import { useUserTracking } from "src/infra/user-tracking";
import {
  bottomActiveTabAtom,
  effectiveBottomTabAtom,
} from "src/state/panel-layout";
import { splitsAtom } from "src/state/layout";

export const toggleBottomPanelShortcut = "ctrl+j";

export const useToggleBottomPanel = () => {
  const setSplits = useSetAtom(splitsAtom);
  const splits = useAtomValue(splitsAtom);
  const activeBottomTab = useAtomValue(bottomActiveTabAtom);
  const effectiveBottomTab = useAtomValue(effectiveBottomTabAtom);
  const exitProfileViewMode = useExitProfileViewMode();
  const userTracking = useUserTracking();

  const toggleBottomPanel = useCallback(
    (_: { source: "toolbar" | "shortcut" }) => {
      if (splits.bottomOpen && activeBottomTab === "profile-view") {
        exitProfileViewMode();
      }
      const newOpen = !splits.bottomOpen;
      setSplits((s) => ({ ...s, bottomOpen: newOpen }));
      userTracking.capture({
        name: "bottomPanel.toggled",
        open: newOpen,
        activeTabId: effectiveBottomTab,
      });
    },
    [
      splits.bottomOpen,
      activeBottomTab,
      effectiveBottomTab,
      exitProfileViewMode,
      setSplits,
      userTracking,
    ],
  );

  return toggleBottomPanel;
};
