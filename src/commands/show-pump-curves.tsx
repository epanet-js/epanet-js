import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { dialogAtom } from "src/state/dialog";

export const useShowPumpLibrary = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();

  const showPumpCurves = useCallback(
    ({ source }: { source: "toolbar" | "pump" }) => {
      userTracking.capture({
        name: "pumpLibrary.opened",
        source,
      });
      setDialogState({ type: "pumpLibrary" });
    },
    [setDialogState, userTracking],
  );

  return showPumpCurves;
};
