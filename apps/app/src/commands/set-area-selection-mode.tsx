import { useAtom, useAtomValue } from "jotai";
import { useCallback } from "react";
import { lastSelectionModeAtom, Mode, modeAtom } from "src/state/mode";
import { useDrawingMode } from "./set-drawing-mode";

export const selectionModeShortcut = "m";

const SELECTION_MODES = [
  Mode.SELECT_RECTANGULAR,
  Mode.SELECT_POLYGONAL,
  Mode.SELECT_FREEHAND,
] as const;

export const useCycleSelectionMode = () => {
  const setDrawingMode = useDrawingMode();
  const currentMode = useAtomValue(modeAtom);
  const [lastSelectionMode, setLastSelectionMode] = useAtom(
    lastSelectionModeAtom,
  );

  const cycleSelectionMode = useCallback(() => {
    const currentIndex = SELECTION_MODES.indexOf(
      currentMode.mode as (typeof SELECTION_MODES)[number],
    );

    if (currentIndex === -1) {
      setDrawingMode(lastSelectionMode);
      return lastSelectionMode;
    }

    const nextIndex = (currentIndex + 1) % SELECTION_MODES.length;
    const nextMode = SELECTION_MODES[nextIndex];

    setLastSelectionMode(nextMode);
    setDrawingMode(nextMode);
    return nextMode;
  }, [
    setDrawingMode,
    currentMode.mode,
    lastSelectionMode,
    setLastSelectionMode,
  ]);

  return cycleSelectionMode;
};
