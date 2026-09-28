import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { useDeactivatePanel } from "src/commands/deactivate-panel";
import { useUserTracking } from "src/infra/user-tracking";
import { panelTrackingName } from "src/panels/panel";
import { activePanelIn } from "src/state/panels";
import { splitsAtom } from "src/state/layout";

const activeVerticalPanelAtom = activePanelIn("vertical");

export const useToggleVerticalPanel = () => {
  const setSplits = useSetAtom(splitsAtom);
  const splits = useAtomValue(splitsAtom);
  const activeVerticalPanel = useAtomValue(activeVerticalPanelAtom);
  const deactivatePanel = useDeactivatePanel();
  const userTracking = useUserTracking();

  const toggleVerticalPanel = useCallback(
    ({ source }: { source: "toolbar" | "handle" }) => {
      if (splits.verticalOpen) {
        deactivatePanel(activeVerticalPanel?.panel);
      }
      const newOpen = !splits.verticalOpen;
      setSplits((s) => ({ ...s, verticalOpen: newOpen }));
      userTracking.capture({
        name: "verticalPanel.toggled",
        open: newOpen,
        activePanelType: activeVerticalPanel
          ? panelTrackingName(activeVerticalPanel.panel)
          : null,
        source,
      });
    },
    [
      splits.verticalOpen,
      activeVerticalPanel,
      deactivatePanel,
      setSplits,
      userTracking,
    ],
  );

  return toggleVerticalPanel;
};
