import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import { mapSyncMomentAtom } from "src/state/map";
import {
  stagingModelDerivedAtom,
  momentLogDerivedAtom,
} from "src/state/derived-branch-state";
import {
  applyMoment,
  computeSyncMoment,
} from "src/lib/persistence/transaction-helpers";

export const useUndoableTransactions = () => {
  const historyControl = useAtomCallback(
    useCallback((get: Getter, set: Setter, direction: "undo" | "redo") => {
      const isUndo = direction === "undo";

      const momentLog = get(momentLogDerivedAtom).copy();
      const currentMapSyncMoment = get(mapSyncMomentAtom);
      const action = isUndo ? momentLog.nextUndo() : momentLog.nextRedo();
      if (!action) return;

      applyMoment(
        get,
        set,
        action.stateId,
        action.moment,
        stagingModelDerivedAtom,
      );

      isUndo ? momentLog.undo() : momentLog.redo();

      const newMapSyncMoment = computeSyncMoment(
        currentMapSyncMoment,
        momentLog,
      );

      set(momentLogDerivedAtom, momentLog);
      set(mapSyncMomentAtom, newMapSyncMoment);
    }, []),
  );

  return { historyControl };
};
