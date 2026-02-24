import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { dialogAtom } from "src/state/dialog";

export const useShowPatterns = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();

  const showPatterns = useCallback(
    ({
      source,
      initialPatternId,
    }: {
      source: "toolbar" | "shortcut" | "reservoir" | "pump";
      initialPatternId?: number;
    }) => {
      userTracking.capture({
        name: "curvesAndPatterns.opened",
        source,
      });
      setDialogState({ type: "patterns", initialPatternId });
    },
    [setDialogState, userTracking],
  );

  return showPatterns;
};
