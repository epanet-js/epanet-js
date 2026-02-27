import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { CurveId } from "src/hydraulic-model/curves";
import { useUserTracking } from "src/infra/user-tracking";
import { dialogAtom } from "src/state/dialog";

export const useShowPumpLibrary = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();

  const showPumpLibrary = useCallback(
    ({
      source,
      curveId,
      initialSection,
    }: {
      source: "toolbar" | "pump";
      curveId?: CurveId;
      initialSection?: "pump" | "efficiency";
    }) => {
      userTracking.capture({
        name: "pumpLibrary.opened",
        source,
      });
      setDialogState({
        type: "pumpLibrary",
        initialCurveId: curveId,
        initialSection,
      });
    },
    [setDialogState, userTracking],
  );

  return showPumpLibrary;
};
