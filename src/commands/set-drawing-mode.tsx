import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { ephemeralStateAtom } from "src/state/jotai";
import { Mode, modeAtom } from "src/state/mode";

export const drawingModeShorcuts: { [key in Mode]: string } = {
  [Mode.NONE]: "1",
  [Mode.DRAW_JUNCTION]: "2",
  [Mode.DRAW_RESERVOIR]: "3",
  [Mode.DRAW_TANK]: "4",
  [Mode.DRAW_PIPE]: "5",
  [Mode.DRAW_PUMP]: "6",
  [Mode.DRAW_VALVE]: "7",
};

export const drawingModeShorcutsDeprecated: { [key in Mode]: string } = {
  [Mode.NONE]: "1",
  [Mode.DRAW_JUNCTION]: "2",
  [Mode.DRAW_PIPE]: "3",
  [Mode.DRAW_RESERVOIR]: "4",
  [Mode.DRAW_PUMP]: "5",
  [Mode.DRAW_VALVE]: "6",
  [Mode.DRAW_TANK]: "7",
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
