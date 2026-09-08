import { useAtomCallback } from "jotai/utils";
import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { panelFor } from "src/panels/panel-template";
import { useIsPanelClosable } from "src/panels/use-panel-closable";
import { useDeactivatePanel } from "./deactivate-panel";
import {
  activatePanelAtom,
  activePanelsAtom,
  placedPanelsAtom,
  forgetPanelAtom,
  panelsAtom,
  panelsByDockAtom,
} from "src/state/panels";

export const useClosePanel = () => {
  const deactivatePanel = useDeactivatePanel();
  const isClosable = useIsPanelClosable();
  const userTracking = useUserTracking();

  return useAtomCallback(
    useCallback(
      (get, set, panelId: string) => {
        const entry = get(placedPanelsAtom).find(
          (placed) => placed.id === panelId,
        );
        if (!entry || !isClosable(entry)) return;

        const { dock } = entry;
        const ids = dock
          ? get(panelsByDockAtom)[dock].map((placed) => placed.id)
          : [];
        const position = ids.indexOf(panelId);
        const neighbour = ids[position + 1] ?? ids[position - 1] ?? null;
        const wasActive = dock
          ? get(activePanelsAtom)[dock]?.id === panelId
          : false;

        deactivatePanel(entry.panel);
        panelFor(entry.panel).onClose?.(
          { get, set, userTracking },
          entry.panel,
        );

        set(panelsAtom, (prev) => prev.filter((panel) => panel.id !== panelId));
        set(forgetPanelAtom, panelId);
        if (wasActive && neighbour) set(activatePanelAtom, neighbour);
      },
      [deactivatePanel, isClosable, userTracking],
    ),
  );
};
