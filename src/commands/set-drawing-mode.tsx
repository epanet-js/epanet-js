import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { ephemeralStateAtom } from "src/state/jotai";
import { Mode, modeAtom } from "src/state/mode";

export const drawingModeShorcuts = {
  "1": Mode.NONE,
  "2": Mode.DRAW_JUNCTION,
  "3": Mode.DRAW_PIPE,
  "4": Mode.DRAW_RESERVOIR,
  "5": Mode.DRAW_PUMP,
  "6": Mode.DRAW_VALVE,
};

export const useDrawingMode = () => {
  const setMode = useSetAtom(modeAtom);
  const setEphemeralState = useSetAtom(ephemeralStateAtom);

  const setDrawingMode = useCallback(
    (mode: Mode) => {
      setEphemeralState({ type: "none" });
      setMode({
        mode,
        modeOptions: { multi: true },
      });
    },
    [setMode, setEphemeralState],
  );

  return setDrawingMode;
};
