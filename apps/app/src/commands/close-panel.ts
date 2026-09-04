import { useAtomValue, useSetAtom } from "jotai";
import { useAtomCallback } from "jotai/utils";
import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { panelFor } from "src/panels/panel-template";
import { useDeactivatePanel } from "./deactivate-panel";
import type { Panel } from "src/panels/panel";
import {
  activatePanelAtom,
  activePanelsAtom,
  placedPanelsAtom,
  panelContentStateAtom,
  panelLayoutAtom,
  panelsAtom,
  panelsByDockAtom,
} from "src/state/panels";

export const useClosePanel = () => {
  const deactivatePanel = useDeactivatePanel();
  const setPanels = useSetAtom(panelsAtom);
  const setLayout = useSetAtom(panelLayoutAtom);
  const setContentState = useSetAtom(panelContentStateAtom);
  const activatePanel = useSetAtom(activatePanelAtom);
  const activePanels = useAtomValue(activePanelsAtom);
  const allPanels = useAtomValue(placedPanelsAtom);
  const byDock = useAtomValue(panelsByDockAtom);
  const userTracking = useUserTracking();

  const runCloseEffect = useAtomCallback(
    useCallback(
      (get, set, panel: Panel) => {
        panelFor(panel).onClose?.({ get, set, userTracking }, panel);
      },
      [userTracking],
    ),
  );

  const forgetPanel = useCallback(
    (panelId: string) => {
      const drop = <T>(prev: Record<string, T>) => {
        if (!(panelId in prev)) return prev;
        const next = { ...prev };
        delete next[panelId];
        return next;
      };
      setLayout(drop);
      setContentState(drop);
    },
    [setLayout, setContentState],
  );

  return useCallback(
    (panelId: string) => {
      const entry = allPanels.find((placed) => placed.id === panelId);
      if (!entry || !entry.closable) return;

      const { dock } = entry;
      const ids = dock ? byDock[dock].map((placed) => placed.id) : [];
      const position = ids.indexOf(panelId);
      const neighbour = ids[position + 1] ?? ids[position - 1] ?? null;

      deactivatePanel(entry.panel);
      runCloseEffect(entry.panel);

      setPanels((prev) => prev.filter((panel) => panel.id !== panelId));
      forgetPanel(panelId);
      if (dock && activePanels[dock]?.id === panelId) {
        if (neighbour) activatePanel(neighbour);
      }
    },
    [
      allPanels,
      byDock,
      activePanels,
      deactivatePanel,
      runCloseEffect,
      forgetPanel,
      setPanels,
      activatePanel,
    ],
  );
};
