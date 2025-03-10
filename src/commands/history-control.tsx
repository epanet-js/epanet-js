import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { usePersistence } from "src/lib/persistence/context";
import { ephemeralStateAtom } from "src/state/jotai";
import { Mode, modeAtom } from "src/state/mode";

export const undoShortcut = "ctrl+z";
export const redoShortcut = "ctrl+y";

export const useHistoryControl = () => {
  const rep = usePersistence();
  const historyControl = rep.useHistoryControl();
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const setMode = useSetAtom(modeAtom);

  const undo = useCallback(() => {
    historyControl("undo");
    setEphemeralState({ type: "none" });
    setMode({ mode: Mode.NONE });
  }, [setEphemeralState, setMode, historyControl]);

  const redo = useCallback(() => {
    historyControl("redo");
    setEphemeralState({ type: "none" });
    setMode({ mode: Mode.NONE });
  }, [setEphemeralState, setMode, historyControl]);

  return { undo, redo };
};
