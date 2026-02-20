import { useAtom, useAtomValue } from "jotai";
import { useCallback } from "react";
import { lastTraceSelectModeAtom, Mode, modeAtom } from "src/state/mode";
import { useDrawingMode } from "./set-drawing-mode";

export const traceSelectModeShortcut = "t";

const TRACE_SELECT_MODES = [
  Mode.BOUNDARY_TRACE_SELECT,
  Mode.UPSTREAM_TRACE_SELECT,
  Mode.DOWNSTREAM_TRACE_SELECT,
] as const;

export const useCycleTraceSelectMode = () => {
  const setDrawingMode = useDrawingMode();
  const currentMode = useAtomValue(modeAtom);
  const [lastTraceSelectMode, setLastTraceSelectMode] = useAtom(
    lastTraceSelectModeAtom,
  );

  const cycleTraceSelectMode = useCallback(() => {
    const currentIndex = TRACE_SELECT_MODES.indexOf(
      currentMode.mode as (typeof TRACE_SELECT_MODES)[number],
    );

    if (currentIndex === -1) {
      setDrawingMode(lastTraceSelectMode);
      return lastTraceSelectMode;
    }

    const nextIndex = (currentIndex + 1) % TRACE_SELECT_MODES.length;
    const nextMode = TRACE_SELECT_MODES[nextIndex];

    setLastTraceSelectMode(nextMode);
    setDrawingMode(nextMode);
    return nextMode;
  }, [
    setDrawingMode,
    currentMode.mode,
    lastTraceSelectMode,
    setLastTraceSelectMode,
  ]);

  return cycleTraceSelectMode;
};
