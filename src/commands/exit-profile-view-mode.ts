import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { Mode, modeAtom } from "src/state/mode";

export const useExitProfileViewMode = () => {
  const { mode } = useAtomValue(modeAtom);
  const setMode = useSetAtom(modeAtom);

  return useCallback(() => {
    if (mode !== Mode.PROFILE_VIEW) return;
    setMode({ mode: Mode.NONE });
  }, [mode, setMode]);
};
