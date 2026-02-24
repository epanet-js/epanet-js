import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { dialogAtom } from "src/state/dialog";

export const useShowPatternsLibrary = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();

  const showPatternsLibrary = useCallback(
    ({
      source,
      initialPatternId,
    }: {
      source: "toolbar" | "shortcut" | "reservoir" | "pump";
      initialPatternId?: number;
    }) => {
      userTracking.capture({
        name: "patternsLibrary.opened",
        source,
      });
      setDialogState({ type: "patternsLibrary", initialPatternId });
    },
    [setDialogState, userTracking],
  );

  return showPatternsLibrary;
};
