import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { Mode, modeAtom } from "src/state/mode";
import { profileViewAtom } from "src/state/profile-view";
import { ephemeralStateAtom } from "src/state/drawing";
import { useUserTracking } from "src/infra/user-tracking";

export const useStartProfileSelection = () => {
  const { mode } = useAtomValue(modeAtom);
  const setMode = useSetAtom(modeAtom);
  const setProfileView = useSetAtom(profileViewAtom);
  const setEphemeral = useSetAtom(ephemeralStateAtom);
  const userTracking = useUserTracking();

  return useCallback(
    ({ source }: { source: "toolbar" | "panel" | "shortcut" }) => {
      if (mode === Mode.PROFILE_VIEW) return;

      userTracking.capture({ name: "profileView.selectionStarted", source });
      setProfileView(null);
      setEphemeral({ type: "profileView" });
      setMode({ mode: Mode.PROFILE_VIEW });
    },
    [mode, setMode, setProfileView, setEphemeral, userTracking],
  );
};
