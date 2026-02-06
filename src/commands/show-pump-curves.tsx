import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { dialogAtom } from "src/state/dialog";

export const useShowPumpCurves = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();

  const showPumpCurves = useCallback(
    ({ source }: { source: "toolbar" | "shortcut" }) => {
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
