import { useAtomCallback } from "jotai/utils";
import { useCallback } from "react";
import {
  activatePanelAtom,
  activePanelsAtom,
  placedPanelsAtom,
} from "src/state/panels";
import { useDeactivatePanel } from "./deactivate-panel";

export const useActivatePanel = () => {
  const deactivatePanel = useDeactivatePanel();

  return useAtomCallback(
    useCallback(
      (get, set, panelId: string) => {
        const dock = get(placedPanelsAtom).find(
          (placed) => placed.id === panelId,
        )?.dock;
        if (!dock) return;

        const leaving = get(activePanelsAtom)[dock];
        if (leaving && leaving.id !== panelId) deactivatePanel(leaving.panel);
        set(activatePanelAtom, panelId);
      },
      [deactivatePanel],
    ),
  );
};
