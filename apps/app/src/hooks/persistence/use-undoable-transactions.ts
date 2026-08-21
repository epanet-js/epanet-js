import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import { mapSyncMomentAtom } from "src/state/map";
import {
  stagingModelDerivedAtom,
  momentLogDerivedAtom,
} from "src/state/derived-branch-state";
import { worktreeAtom } from "src/state/scenarios";
import { historyPendingAtom } from "src/state/transactions";
import {
  applyMoment,
  computeSyncMoment,
  prepareHistoryAction,
  type HistoryAction,
} from "src/lib/persistence/transaction-helpers";
import type { MomentLog } from "src/lib/persistence/moment-log";
import { applyMomentToDb, buildMomentPayload } from "src/lib/db";
import type { ApplyMomentPayload } from "@epanet-js/ejsdb";
import { captureError, captureWarning } from "src/infra/error-tracking";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import {
  writeQueue,
  type WriteFailureHandler,
} from "src/lib/persistence/write-queue";
import { useWriteFailureHandler } from "src/hooks/persistence/use-write-failure-handler";

type CommitDeps = {
  isChangeTrackerOn: boolean;
  onWriteFailure: WriteFailureHandler;
};

const commitHistoryAction = (
  get: Getter,
  set: Setter,
  direction: "undo" | "redo",
  action: HistoryAction,
  momentLog: MomentLog,
  { isChangeTrackerOn, onWriteFailure }: CommitDeps,
) => {
  const isUndo = direction === "undo";
  const currentMapSyncMoment = get(mapSyncMomentAtom);

  const worktree = get(worktreeAtom);
  const willPersist = worktree.activeBranchId === worktree.mainId;

  let payload: ApplyMomentPayload | null = null;
  if (willPersist) {
    try {
      payload = buildMomentPayload(action.moment);
    } catch (error) {
      captureError(error instanceof Error ? error : new Error(String(error)));
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
    writeQueue.enqueue(() => applyMomentToDb(payload), onWriteFailure);
  }

  isUndo ? momentLog.undo() : momentLog.redo();

  set(momentLogDerivedAtom, momentLog);
  if (!isChangeTrackerOn) {
    set(mapSyncMomentAtom, computeSyncMoment(currentMapSyncMoment, momentLog));
  }
};

const nextAction = (
  momentLog: MomentLog,
  direction: "undo" | "redo",
): HistoryAction | null =>
  direction === "undo" ? momentLog.nextUndo() : momentLog.nextRedo();

export const useUndoableTransactions = () => {
  const isChangeTrackerOn = useFeatureFlag("FLAG_CHANGE_TRACKER");
  const isAsyncUndoOn = useFeatureFlag("FLAG_ASYNC_UNDO");
  const onWriteFailure = useWriteFailureHandler();

  const historyControlDeprecated = useAtomCallback(
    useCallback(
      (
        get: Getter,
        set: Setter,
        direction: "undo" | "redo",
      ): Promise<boolean> => {
        const momentLog = get(momentLogDerivedAtom).copy();
        const action = nextAction(momentLog, direction);
        if (!action) return Promise.resolve(false);

        commitHistoryAction(get, set, direction, action, momentLog, {
          isChangeTrackerOn,
          onWriteFailure,
        });
        return Promise.resolve(true);
      },
      [isChangeTrackerOn, onWriteFailure],
    ),
  );

  const historyControlAsync = useAtomCallback(
    useCallback(
      async (
        get: Getter,
        set: Setter,
        direction: "undo" | "redo",
      ): Promise<boolean> => {
        if (get(historyPendingAtom)) return false;

        const action = nextAction(get(momentLogDerivedAtom).copy(), direction);
        if (!action) return false;

        set(historyPendingAtom, true);
        try {
          const prepared = await prepareHistoryAction(action);

          const momentLog = get(momentLogDerivedAtom).copy();
          const pending = nextAction(momentLog, direction);
          if (!pending || pending.stateId !== prepared.stateId) {
            captureWarning(
              `History ${direction} discarded: the moment log moved while preparing`,
            );
            return false;
          }

          commitHistoryAction(get, set, direction, prepared, momentLog, {
            isChangeTrackerOn,
            onWriteFailure,
          });
          return true;
        } finally {
          set(historyPendingAtom, false);
        }
      },
      [isChangeTrackerOn, onWriteFailure],
    ),
  );

  const historyControl = isAsyncUndoOn
    ? historyControlAsync
    : historyControlDeprecated;

  return { historyControl };
};
