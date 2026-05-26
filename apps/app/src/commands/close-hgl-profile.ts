import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { Mode, modeAtom } from "src/state/mode";
import { hglProfileAtom, hglProfileOpenAtom } from "src/state/hgl-profile";
import { useUserTracking } from "src/infra/user-tracking";

export const useCloseHglProfile = () => {
  const { mode } = useAtomValue(modeAtom);
  const setMode = useSetAtom(modeAtom);
  const setHglProfile = useSetAtom(hglProfileAtom);
  const setHglProfileOpen = useSetAtom(hglProfileOpenAtom);
  const userTracking = useUserTracking();

  return useCallback(
    ({ source }: { source: "tab" }) => {
      userTracking.capture({ name: "profileView.closed", source });
      setHglProfileOpen(false);
      if (mode === Mode.HGL_PROFILE) {
        setMode({ mode: Mode.NONE });
        return;
      }
      setHglProfile(null);
    },
    [mode, setMode, setHglProfile, setHglProfileOpen, userTracking],
  );
};
