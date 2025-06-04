import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { dialogAtom } from "src/state/dialog_state";

export const useShowSimulationSettings = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();

  const showSimulationSettings = useCallback(
    ({ source }: { source: "toolbar" | "shortcut" }) => {
      userTracking.capture({
        name: "simulationSettings.opened",
        source,
      });
      setDialogState({ type: "simulationSettings" });
    },
    [setDialogState, userTracking],
  );

  return showSimulationSettings;
};
