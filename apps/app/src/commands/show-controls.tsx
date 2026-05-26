import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { dialogAtom } from "src/state/dialog";

export const showControlsShortcut = "alt+c";

export const useShowControls = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();

  const showControls = useCallback(
    ({ source }: { source: "toolbar" | "shortcut" }) => {
      userTracking.capture({
        name: "controls.opened",
        source,
      });
      setDialogState({ type: "controls" });
    },
    [setDialogState, userTracking],
  );

  return showControls;
};
