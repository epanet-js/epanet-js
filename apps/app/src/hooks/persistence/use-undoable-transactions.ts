import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import {
  stagingModelDerivedAtom,
  sessionHistoryDerivedAtom,
} from "src/state/derived-branch-state";
import { worktreeAtom } from "src/state/scenarios";
import { historyPendingAtom } from "src/state/transactions";
import type {
  HistoryEntry,
  SessionHistory,
} from "src/lib/persistence/session-history";
import {
  useChangeSetHandlers,
  type ChangeSetHandlers,
} from "src/hooks/persistence/use-change-set-handlers";
import type { Direction } from "@epanet-js/change-set";
import { timedSync } from "@epanet-js/ejsdb";
import {
  writeQueue,
  type WriteFailureHandler,
} from "src/lib/persistence/write-queue";
import { useWriteFailureHandler } from "src/hooks/persistence/use-write-failure-handler";

const commitHistoryEntry = (
  get: Getter,
  set: Setter,
  direction: "undo" | "redo",
  entry: HistoryEntry,
  sessionHistory: SessionHistory,
  onWriteFailure: WriteFailureHandler,
  handlers: ChangeSetHandlers,
) => {
  const isUndo = direction === "undo";
  const changeDirection: Direction = isUndo ? "reverse" : "forward";

  const worktree = get(worktreeAtom);

  timedSync(
    "changeSet:apply",
    () =>
      handlers.apply(
        get,
        set,
        entry.stateId,
        entry.changeSet,
        changeDirection,
        stagingModelDerivedAtom,
      ),
    { direction: changeDirection },
  );

  isUndo ? sessionHistory.undo() : sessionHistory.redo();

  writeQueue.enqueue(
    () => handlers.persist(worktree, entry.changeSet, changeDirection),
    onWriteFailure,
  );

  set(sessionHistoryDerivedAtom, sessionHistory);
};

const nextEntry = (
  sessionHistory: SessionHistory,
  direction: "undo" | "redo",
): HistoryEntry | null =>
  direction === "undo" ? sessionHistory.nextUndo() : sessionHistory.nextRedo();

export const useUndoableTransactions = () => {
  const onWriteFailure = useWriteFailureHandler();
  const handlers = useChangeSetHandlers();

  const historyControl = useAtomCallback(
    useCallback(
      (get: Getter, set: Setter, direction: "undo" | "redo"): boolean => {
        if (get(historyPendingAtom)) return false;

        const sessionHistory = get(sessionHistoryDerivedAtom).copy();
        const entry = nextEntry(sessionHistory, direction);
        if (!entry) return false;

        set(historyPendingAtom, true);
        try {
          commitHistoryEntry(
            get,
            set,
            direction,
            entry,
            sessionHistory,
            onWriteFailure,
            handlers,
          );
          return true;
        } finally {
          set(historyPendingAtom, false);
        }
      },
      [onWriteFailure, handlers],
    ),
  );

  return { historyControl };
};
