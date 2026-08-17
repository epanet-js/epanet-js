import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import { mapSyncMomentAtom } from "src/state/map";
import {
  stagingModelDerivedAtom,
  momentLogDerivedAtom,
} from "src/state/derived-branch-state";
import { worktreeAtom } from "src/state/scenarios";
import {
  applyMoment,
  computeSyncMoment,
} from "src/lib/persistence/transaction-helpers";
import { applyMomentToDb, buildMomentPayload } from "src/lib/db";
import type { ApplyMomentPayload } from "@epanet-js/ejsdb";
import { captureError } from "src/infra/error-tracking";
import { handleError } from "src/infra/errors";
import { opfsUnavailableErrors } from "src/infra/storage";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { writeQueue } from "src/lib/persistence/write-queue";
import { useWriteFailureHandler } from "src/hooks/persistence/use-write-failure-handler";

export const useUndoableTransactions = () => {
  const isQueueOn = useFeatureFlag("FLAG_TRANSACTIONS_QUEUE");
  const isChangeTrackerOn = useFeatureFlag("FLAG_CHANGE_TRACKER");
  const onWriteFailure = useWriteFailureHandler();

  const historyControl = useAtomCallback(
    useCallback(
      (get: Getter, set: Setter, direction: "undo" | "redo") => {
        const isUndo = direction === "undo";

        const momentLog = get(momentLogDerivedAtom).copy();
        const currentMapSyncMoment = get(mapSyncMomentAtom);
        const action = isUndo ? momentLog.nextUndo() : momentLog.nextRedo();
        if (!action) return;

        const worktree = get(worktreeAtom);
        const willPersist = worktree.activeBranchId === worktree.mainId;

        let payload: ApplyMomentPayload | null = null;
        if (willPersist) {
          try {
            payload = buildMomentPayload(action.moment);
          } catch (error) {
            captureError(
              error instanceof Error ? error : new Error(String(error)),
            );
          }
        }

        applyMoment(
          get,
          set,
          action.stateId,
          action.moment,
          stagingModelDerivedAtom,
          isChangeTrackerOn,
        );

        if (payload) {
          if (isQueueOn) {
            writeQueue.enqueue(() => applyMomentToDb(payload), onWriteFailure);
          } else {
            void applyMomentToDb(payload).catch((error) =>
              handleError(error, {
                as: "Undoable transaction: db write failed",
                warn: opfsUnavailableErrors,
                onUnexpected: "capture",
              }),
            );
          }
        }

        isUndo ? momentLog.undo() : momentLog.redo();

        set(momentLogDerivedAtom, momentLog);
        if (!isChangeTrackerOn) {
          set(
            mapSyncMomentAtom,
            computeSyncMoment(currentMapSyncMoment, momentLog),
          );
        }
      },
      [isQueueOn, isChangeTrackerOn, onWriteFailure],
    ),
  );

  return { historyControl };
};
