import { useAtomCallback } from "jotai/utils";
import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { panelTrackingName } from "src/panels/panel";
import {
  panelsByDockAtom,
  placedPanelsAtom,
  reorderPanelAtom,
} from "src/state/panels";

export const useReorderPanel = () => {
  const userTracking = useUserTracking();

  return useAtomCallback(
    useCallback(
      (get, set, activeId: string, overId: string) => {
        const entry = get(placedPanelsAtom).find(
          (placed) => placed.id === activeId,
        );
        if (!entry || !entry.dock) return;

        const { dock } = entry;
        const ids = get(panelsByDockAtom)[dock].map((placed) => placed.id);
        const fromIndex = ids.indexOf(activeId);
        const toIndex = ids.indexOf(overId);
        if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

        set(reorderPanelAtom, { dock, activeId, overId });
        userTracking.capture({
          name: "bottomPanel.tabReordered",
          panelType: panelTrackingName(entry.panel),
          fromIndex,
          toIndex,
        });
      },
      [userTracking],
    ),
  );
};
