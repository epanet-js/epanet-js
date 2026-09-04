import { useAtomCallback } from "jotai/utils";
import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { panelFor } from "src/panels/panel-template";
import type { Panel } from "src/panels/panel";

export const useDeactivatePanel = () => {
  const userTracking = useUserTracking();

  return useAtomCallback(
    useCallback(
      (get, set, panel: Panel | null | undefined) => {
        if (!panel) return;
        panelFor(panel).onDeactivate?.({ get, set, userTracking }, panel);
      },
      [userTracking],
    ),
  );
};
