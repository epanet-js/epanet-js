import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import { momentLogAtom } from "src/state/model-changes";
import { mapSyncMomentAtom } from "src/state/map";
import {
  applyMoment,
  computeSyncMoment,
  syncSnapshotMomentLog,
  updateModelCache,
  syncBranchState,
} from "src/lib/persistence/transaction-helpers";

export const useUndoableTransactions = () => {
  const historyControl = useAtomCallback(
    useCallback((get: Getter, set: Setter, direction: "undo" | "redo") => {
      const isUndo = direction === "undo";
      const momentLog = get(momentLogAtom).copy();
      const currentMapSyncMoment = get(mapSyncMomentAtom);
      const action = isUndo ? momentLog.nextUndo() : momentLog.nextRedo();
      if (!action) return;

      applyMoment(get, set, action.stateId, action.moment);

      isUndo ? momentLog.undo() : momentLog.redo();

      const newMapSyncMoment = computeSyncMoment(
        currentMapSyncMoment,
        momentLog,
      );

      set(momentLogAtom, momentLog);
      set(mapSyncMomentAtom, newMapSyncMoment);
      syncSnapshotMomentLog(get, set, momentLog, action.stateId);
      updateModelCache(get, set);
      syncBranchState(get, set, momentLog, action.stateId);
    }, []),
  );

  return { historyControl };
};
