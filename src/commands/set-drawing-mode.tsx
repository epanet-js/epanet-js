import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { ephemeralStateAtom } from "src/state/drawing";
import { selectionAtom } from "src/state/selection";
import { lastDrawingModeAtom, Mode, modeAtom } from "src/state/mode";
import { USelection } from "src/selection/selection";

const DRAWING_MODES = [
  Mode.DRAW_JUNCTION,
  Mode.DRAW_RESERVOIR,
  Mode.DRAW_TANK,
  Mode.DRAW_PIPE,
  Mode.DRAW_PUMP,
  Mode.DRAW_VALVE,
  Mode.DRAW_CUSTOMER_POINT,
] as const;

const SELECTION_MODES = [
  Mode.NONE,
  Mode.SELECT_RECTANGULAR,
  Mode.SELECT_POLYGONAL,
  Mode.SELECT_FREEHAND,
  Mode.BOUNDARY_TRACE_SELECT,
  Mode.UPSTREAM_TRACE_SELECT,
  Mode.DOWNSTREAM_TRACE_SELECT,
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
  [Mode.DRAW_CUSTOMER_POINT]: "8",
  [Mode.CONNECT_CUSTOMER_POINTS]: "",
  [Mode.REDRAW_LINK]: "",
  [Mode.BOUNDARY_TRACE_SELECT]: "",
  [Mode.UPSTREAM_TRACE_SELECT]: "",
  [Mode.DOWNSTREAM_TRACE_SELECT]: "",
  [Mode.PROFILE_VIEW]: "",
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

export const useCycleDrawingMode = () => {
  const setDrawingMode = useDrawingMode();
  const currentMode = useAtomValue(modeAtom);
  const [lastDrawingMode, setLastDrawingMode] = useAtom(lastDrawingModeAtom);

  const cycleDrawingMode = useCallback(() => {
    const currentIndex = DRAWING_MODES.indexOf(
      currentMode.mode as (typeof DRAWING_MODES)[number],
    );

    if (currentIndex === -1) {
      setDrawingMode(lastDrawingMode);
      return lastDrawingMode;
    }

    const nextIndex = (currentIndex + 1) % DRAWING_MODES.length;
    const nextMode = DRAWING_MODES[nextIndex];

    setLastDrawingMode(nextMode);
    setDrawingMode(nextMode);
    return nextMode;
  }, [setDrawingMode, currentMode.mode, lastDrawingMode, setLastDrawingMode]);

  return cycleDrawingMode;
};
