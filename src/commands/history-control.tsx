import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { usePersistence } from "src/lib/persistence";
import { ephemeralStateAtom } from "src/state/jotai";
import { Mode, modeAtom } from "src/state/mode";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export const undoShortcut = "ctrl+z";
export const redoShortcut = "ctrl+y";

export const useHistoryControl = () => {
  const rep = usePersistence();
  const historyControl = rep.useHistoryControl();
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const setMode = useSetAtom(modeAtom);
  const isSimulationLoose = useFeatureFlag("FLAG_SIMULATION_LOOSE");

  const undo = useCallback(async () => {
    await historyControl("undo", { restoreSimulation: isSimulationLoose });
    setEphemeralState({ type: "none" });
    setMode({ mode: Mode.NONE });
  }, [setEphemeralState, setMode, historyControl, isSimulationLoose]);

  const redo = useCallback(async () => {
    await historyControl("redo", { restoreSimulation: isSimulationLoose });
    setEphemeralState({ type: "none" });
    setMode({ mode: Mode.NONE });
  }, [setEphemeralState, setMode, historyControl, isSimulationLoose]);

  return { undo, redo };
};
