import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { CurveId } from "src/hydraulic-model/curves";
import { useUserTracking } from "src/infra/user-tracking";
import { dialogAtom } from "src/state/dialog";

export const useShowCurveLibrary = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();

  const showCurveLibrary = useCallback(
    ({ source, curveId }: { source: "toolbar"; curveId?: CurveId }) => {
      userTracking.capture({
        name: "curveLibrary.opened",
        source,
      });
      setDialogState({ type: "curveLibrary", initialCurveId: curveId });
    },
    [setDialogState, userTracking],
  );

  return showCurveLibrary;
};
