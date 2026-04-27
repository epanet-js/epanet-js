import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { dialogAtom } from "src/state/dialog";

import { useUserTracking } from "src/infra/user-tracking";

export const useShowExamples = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();

  return useCallback(
    ({ source }: { source: string }) => {
      setDialogState({ type: "examples" });
      userTracking.capture({ name: "examples.opened", source });
    },
    [setDialogState, userTracking],
  );
};
