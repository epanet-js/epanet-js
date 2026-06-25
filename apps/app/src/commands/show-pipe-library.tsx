import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { usePermissions } from "src/hooks/use-permissions";
import { dialogAtom } from "src/state/dialog";

export const useShowPipeLibrary = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();
  const { canUsePipeLibrary } = usePermissions();

  const showPipeLibrary = useCallback(
    ({ source }: { source: "toolbar" }) => {
      userTracking.capture({
        name: "pipeLibrary.opened",
        source,
        canUsePipeLibrary,
      });

      if (!canUsePipeLibrary) {
        setDialogState({ type: "featurePaywall", feature: "pipeLibrary" });
        return;
      }

      setDialogState({
        type: "pipeLibrary",
      });
    },
    [setDialogState, userTracking, canUsePipeLibrary],
  );

  return showPipeLibrary;
};
