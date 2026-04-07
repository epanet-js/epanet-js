import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { usePersistence } from "src/lib/persistence";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useUndoableTransactions } from "src/hooks/persistence/use-undoable-transactions";
import { ephemeralStateAtom } from "src/state/drawing";
import { Mode, modeAtom } from "src/state/mode";

export const undoShortcut = "ctrl+z";
export const redoShortcut = "ctrl+y";

export const useHistoryControl = () => {
  const isStateRefactorOn = useFeatureFlag("FLAG_STATE_REFACTOR");
  const rep = usePersistence();
  const historyControlDeprecated = rep.useHistoryControlDeprecated();
  const { historyControl: historyControlNew } = useUndoableTransactions();
  const historyControl = isStateRefactorOn
    ? historyControlNew
    : historyControlDeprecated;
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
