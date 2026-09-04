import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { useDeactivatePanel } from "src/commands/deactivate-panel";
import { useUserTracking } from "src/infra/user-tracking";
import { activePanelIn } from "src/state/panels";
import { splitsAtom } from "src/state/layout";

export const toggleBottomPanelShortcut = "ctrl+j";

export const useToggleBottomPanel = () => {
  const setSplits = useSetAtom(splitsAtom);
  const splits = useAtomValue(splitsAtom);
  const activeBottomPanel = useAtomValue(activePanelIn("bottom"));
  const deactivatePanel = useDeactivatePanel();
  const userTracking = useUserTracking();

  const toggleBottomPanel = useCallback(
    ({ source }: { source: "toolbar" | "shortcut" }) => {
      if (splits.bottomOpen) {
        deactivatePanel(activeBottomPanel?.panel);
      }
      const newOpen = !splits.bottomOpen;
      setSplits((s) => ({ ...s, bottomOpen: newOpen }));
      userTracking.capture({
        name: "bottomPanel.toggled",
        open: newOpen,
        activeTabId: activeBottomPanel?.id ?? null,
        source,
      });
    },
    [
      splits.bottomOpen,
      activeBottomPanel,
      deactivatePanel,
      setSplits,
      userTracking,
    ],
  );

  return toggleBottomPanel;
};
