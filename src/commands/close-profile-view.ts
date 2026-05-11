import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { Mode, modeAtom } from "src/state/mode";
import { profileViewAtom, profileViewOpenAtom } from "src/state/profile-view";
import { useUserTracking } from "src/infra/user-tracking";

export const useCloseProfileView = () => {
  const { mode } = useAtomValue(modeAtom);
  const setMode = useSetAtom(modeAtom);
  const setProfileView = useSetAtom(profileViewAtom);
  const setProfileViewOpen = useSetAtom(profileViewOpenAtom);
  const userTracking = useUserTracking();

  return useCallback(
    ({ source }: { source: "tab" }) => {
      userTracking.capture({ name: "profileView.closed", source });
      setProfileViewOpen(false);
      if (mode === Mode.PROFILE_VIEW) {
        setMode({ mode: Mode.NONE });
        return;
      }
      setProfileView(null);
    },
    [mode, setMode, setProfileView, setProfileViewOpen, userTracking],
  );
};
