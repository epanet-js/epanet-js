import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { ephemeralStateAtom, selectionAtom } from "src/state/jotai";
import { Mode, modeAtom } from "src/state/mode";
import { USelection } from "src/selection/selection";

const SELECTION_MODES = [
  Mode.NONE,
  Mode.SELECT_RECTANGULAR,
  Mode.SELECT_POLYGONAL,
  Mode.SELECT_FREEHAND,
] as const;

const isSelectionMode = (mode: Mode): boolean =>
  SELECTION_MODES.includes(mode as (typeof SELECTION_MODES)[number]);

export const drawingModeShorcuts: { [key in Mode]: string } = {
  [Mode.NONE]: "1",
  [Mode.SELECT_RECTANGULAR]: "",
  [Mode.SELECT_POLYGONAL]: "",
  [Mode.SELECT_FREEHAND]: "",
  [Mode.DRAW_JUNCTION]: "2",
  [Mode.DRAW_RESERVOIR]: "3",
  [Mode.DRAW_TANK]: "4",
  [Mode.DRAW_PIPE]: "5",
  [Mode.DRAW_PUMP]: "6",
  [Mode.DRAW_VALVE]: "7",
  [Mode.CONNECT_CUSTOMER_POINTS]: "",
  [Mode.REDRAW_LINK]: "",
};

export const useDrawingMode = () => {
  const setMode = useSetAtom(modeAtom);
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const setSelection = useSetAtom(selectionAtom);
  const currentMode = useAtomValue(modeAtom);

  const setDrawingMode = useCallback(
    (mode: Mode) => {
      setEphemeralState({ type: "none" });

      if (currentMode.mode !== mode) {
        const fromSelectionMode = isSelectionMode(currentMode.mode);
        const toSelectionMode = isSelectionMode(mode);

        if (!(fromSelectionMode && toSelectionMode)) {
          setSelection(USelection.none());
        }
      }

      setMode({
        mode,
      });
    },
    [setMode, setEphemeralState, setSelection, currentMode.mode],
  );

  return setDrawingMode;
};
