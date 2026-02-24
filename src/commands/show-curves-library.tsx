import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { CurveId } from "src/hydraulic-model/curves";
import { useUserTracking } from "src/infra/user-tracking";
import { dialogAtom } from "src/state/dialog";

export const useShowCurvesLibrary = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();

  const showCurvesLibrary = useCallback(
    ({
      source,
      curveId,
    }: {
      source: "toolbar" | "pump";
      curveId?: CurveId;
    }) => {
      userTracking.capture({
        name: "curvesLibrary.opened",
        source,
      });
      setDialogState({ type: "curvesLibrary", initialCurveId: curveId });
    },
    [setDialogState, userTracking],
  );

  return showCurvesLibrary;
};
