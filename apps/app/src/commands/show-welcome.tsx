import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { dialogAtom } from "src/state/dialog";

import { WelcomeOpened, useUserTracking } from "src/infra/user-tracking";

export const useShowWelcome = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();

  const showWelcome = useCallback(
    ({ source }: { source: WelcomeOpened["source"] }) => {
      setDialogState({ type: "welcome" });
      userTracking.capture({ name: "welcome.opened", source });
    },
    [setDialogState, userTracking],
  );

  return showWelcome;
};
