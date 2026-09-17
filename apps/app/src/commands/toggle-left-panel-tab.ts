import { useAtomCallback } from "jotai/utils";
import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { panelTrackingName } from "src/panels/panel";
import { defaultSplits, splitsAtom } from "src/state/layout";
import { activatePanelAtom, activePanelIn, panelsIn } from "src/state/panels";
import { useActivatePanel } from "./activate-panel";
import { useDeactivatePanel } from "./deactivate-panel";

const leftPanelsAtom = panelsIn("left");
const activeLeftPanelAtom = activePanelIn("left");

export const useToggleLeftPanelTab = () => {
  const activatePanel = useActivatePanel();
  const deactivatePanel = useDeactivatePanel();
  const userTracking = useUserTracking();

  return useAtomCallback(
    useCallback(
      (get, set, panelId: string) => {
        const pressed = get(leftPanelsAtom).find(
          (entry) => entry.id === panelId,
        );
        if (!pressed) return;

        const { leftOpen } = get(splitsAtom);
        const active = get(activeLeftPanelAtom);

        if (leftOpen && active?.id !== panelId) {
          userTracking.capture({
            name: "leftPanel.tabSwitched",
            panelType: panelTrackingName(pressed.panel),
          });
          activatePanel(panelId);
          return;
        }

        if (leftOpen) {
          deactivatePanel(active?.panel);
        } else {
          set(activatePanelAtom, panelId);
        }
        set(splitsAtom, (splits) => ({
          ...splits,
          leftOpen: !leftOpen,
          left: defaultSplits.left,
        }));
        userTracking.capture({
          name: "leftPanel.toggled",
          open: !leftOpen,
          activePanelType: panelTrackingName(pressed.panel),
          source: "activityBar",
        });
      },
      [activatePanel, deactivatePanel, userTracking],
    ),
  );
};
