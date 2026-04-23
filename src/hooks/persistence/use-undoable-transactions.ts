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
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { applyMomentToDb } from "src/lib/db";
import { captureError } from "src/infra/error-tracking";

export const useUndoableTransactions = () => {
  const isOurFileOn = useFeatureFlag("FLAG_OUR_FILE");
  const historyControl = useAtomCallback(
    useCallback(
      (get: Getter, set: Setter, direction: "undo" | "redo") => {
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

        if (isOurFileOn) {
          void applyMomentToDb(action.moment).catch(captureError);
        }

        isUndo ? momentLog.undo() : momentLog.redo();

        const newMapSyncMoment = computeSyncMoment(
          currentMapSyncMoment,
          momentLog,
        );

        set(momentLogDerivedAtom, momentLog);
        set(mapSyncMomentAtom, newMapSyncMoment);
      },
      [isOurFileOn],
    ),
  );

  return { historyControl };
};
