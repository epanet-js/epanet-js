import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import {
  stagingModelDerivedAtom,
  momentLogDerivedAtom,
} from "src/state/derived-branch-state";
import { worktreeAtom } from "src/state/scenarios";
import { historyPendingAtom } from "src/state/transactions";
import {
  applyMoment,
  prepareHistoryAction,
  type HistoryAction,
} from "src/lib/persistence/transaction-helpers";
import type { MomentLog } from "src/lib/persistence/moment-log";
import { applyMomentToDb, buildMomentPayload } from "src/lib/db";
import type { ApplyMomentPayload } from "@epanet-js/ejsdb";
import { captureError, captureWarning } from "src/infra/error-tracking";
import {
  writeQueue,
  type WriteFailureHandler,
} from "src/lib/persistence/write-queue";
import { useWriteFailureHandler } from "src/hooks/persistence/use-write-failure-handler";

const commitHistoryAction = (
  get: Getter,
  set: Setter,
  direction: "undo" | "redo",
  action: HistoryAction,
  momentLog: MomentLog,
  onWriteFailure: WriteFailureHandler,
) => {
  const isUndo = direction === "undo";

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

  applyMoment(get, set, action.stateId, action.moment, stagingModelDerivedAtom);

  isUndo ? momentLog.undo() : momentLog.redo();

  if (payload) {
    writeQueue.enqueue(() => applyMomentToDb(payload), onWriteFailure);
  }

  set(momentLogDerivedAtom, momentLog);
};

const nextAction = (
  momentLog: MomentLog,
  direction: "undo" | "redo",
): HistoryAction | null =>
  direction === "undo" ? momentLog.nextUndo() : momentLog.nextRedo();

export const useUndoableTransactions = () => {
  const onWriteFailure = useWriteFailureHandler();

  const historyControl = useAtomCallback(
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

          commitHistoryAction(
            get,
            set,
            direction,
            prepared,
            momentLog,
            onWriteFailure,
          );
          return true;
        } finally {
          set(historyPendingAtom, false);
        }
      },
      [onWriteFailure],
    ),
  );

  return { historyControl };
};
