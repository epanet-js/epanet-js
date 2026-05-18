import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { Mode, modeAtom } from "src/state/mode";
import { hglProfileAtom } from "src/state/hgl-profile";
import { ephemeralStateAtom } from "src/state/drawing";
import { useUserTracking } from "src/infra/user-tracking";

export const useStartProfileSelection = () => {
  const { mode } = useAtomValue(modeAtom);
  const setMode = useSetAtom(modeAtom);
  const setHglProfile = useSetAtom(hglProfileAtom);
  const setEphemeral = useSetAtom(ephemeralStateAtom);
  const userTracking = useUserTracking();

  return useCallback(
    ({ source }: { source: "toolbar" | "panel" | "shortcut" }) => {
      if (mode === Mode.HGL_PROFILE) return;

      userTracking.capture({ name: "profileView.selectionStarted", source });
      setHglProfile(null);
      setEphemeral({ type: "hglProfile" });
      setMode({ mode: Mode.HGL_PROFILE });
    },
    [mode, setMode, setHglProfile, setEphemeral, userTracking],
  );
};
