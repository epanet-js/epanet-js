import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { dialogAtom } from "src/state/dialog";

export const useShowCurvesAndPatterns = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();

  const showCurvesAndPatterns = useCallback(
    ({ source }: { source: "toolbar" | "shortcut" }) => {
      userTracking.capture({
        name: "curvesAndPatterns.opened",
        source,
      });
      setDialogState({ type: "curvesAndPatterns" });
    },
    [setDialogState, userTracking],
  );

  return showCurvesAndPatterns;
};
