import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { splitsAtom } from "src/state/layout";
import { panelsAtom } from "src/state/panels";
import { useActivatePanel } from "./activate-panel";
import {
  HGL_PANEL_ID,
  createHglProfilePanel,
} from "src/panels/hgl-profile/create-panel";
import { useUserTracking } from "src/infra/user-tracking";

export const useShowHglProfile = () => {
  const setSplits = useSetAtom(splitsAtom);
  const activatePanel = useActivatePanel();
  const setPanels = useSetAtom(panelsAtom);
  const userTracking = useUserTracking();

  return useCallback(
    ({ source }: { source: "toolbar" | "shortcut" }) => {
      userTracking.capture({ name: "profileView.opened", source });
      setPanels((prev) =>
        prev.some((panel) => panel.id === HGL_PANEL_ID)
          ? prev
          : [...prev, createHglProfilePanel()],
      );
      setSplits((s) => ({ ...s, bottomOpen: true }));
      activatePanel(HGL_PANEL_ID);
    },
    [setSplits, activatePanel, setPanels, userTracking],
  );
};
