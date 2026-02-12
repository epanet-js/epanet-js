import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { CurveId } from "src/hydraulic-model/curves";
import { useUserTracking } from "src/infra/user-tracking";
import { dialogAtom } from "src/state/dialog";

export const useShowPumpLibrary = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();

  const showPumpCurves = useCallback(
    ({
      source,
      curveId,
    }: {
      source: "toolbar" | "pump";
      curveId?: CurveId;
    }) => {
      userTracking.capture({
        name: "pumpLibrary.opened",
        source,
      });
      setDialogState({ type: "pumpLibrary", initialCurveId: curveId });
    },
    [setDialogState, userTracking],
  );

  return showPumpCurves;
};
