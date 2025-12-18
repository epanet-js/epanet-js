import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { dialogAtom } from "src/state/dialog";

export const useShowControls = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();

  const showControls = useCallback(
    ({ source }: { source: "toolbar" }) => {
      userTracking.capture({
        name: "assetControls.opened",
        source,
      });
      setDialogState({ type: "controls" });
    },
    [setDialogState, userTracking],
  );

  return showControls;
};
