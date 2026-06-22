import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { dialogAtom } from "src/state/dialog";

export const useShowPipeLibrary = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();

  const showPipeLibrary = useCallback(
    ({ source }: { source: "toolbar" }) => {
      userTracking.capture({
        name: "pipeLibrary.opened",
        source,
      });
      setDialogState({
        type: "pipeLibrary",
      });
    },
    [setDialogState, userTracking],
  );

  return showPipeLibrary;
};
