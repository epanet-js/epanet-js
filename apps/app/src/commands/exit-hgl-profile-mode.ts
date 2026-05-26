import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { Mode, modeAtom } from "src/state/mode";

export const useExitHglProfileMode = () => {
  const { mode } = useAtomValue(modeAtom);
  const setMode = useSetAtom(modeAtom);

  return useCallback(() => {
    if (mode !== Mode.HGL_PROFILE) return;
    setMode({ mode: Mode.NONE });
  }, [mode, setMode]);
};
