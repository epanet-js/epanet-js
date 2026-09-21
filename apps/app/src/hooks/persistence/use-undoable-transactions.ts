import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import {
  stagingModelDerivedAtom,
  sessionHistoryDerivedAtom,
} from "src/state/derived-branch-state";
import { worktreeAtom } from "src/state/scenarios";
import { historyPendingAtom } from "src/state/transactions";
import { applyChange } from "src/lib/persistence/transaction-helpers";
import type {
  HistoryEntry,
  SessionHistory,
} from "src/lib/persistence/session-history";
import { persistBranchChange } from "src/lib/persistence/persist-branch-change";
import type { Direction } from "@epanet-js/change-set";
import { timedSync } from "@epanet-js/ejsdb";
import {
  writeQueue,
  type WriteFailureHandler,
} from "src/lib/persistence/write-queue";
import { useWriteFailureHandler } from "src/hooks/persistence/use-write-failure-handler";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

const commitHistoryEntry = (
  get: Getter,
  set: Setter,
  direction: "undo" | "redo",
  entry: HistoryEntry,
  sessionHistory: SessionHistory,
  isPersistScenariosOn: boolean,
  onWriteFailure: WriteFailureHandler,
) => {
  const isUndo = direction === "undo";
  const changeDirection: Direction = isUndo ? "reverse" : "forward";

  const worktree = get(worktreeAtom);
  const willPersist =
    worktree.activeBranchId === worktree.mainId || isPersistScenariosOn;

  timedSync(
    "changeSet:apply",
    () =>
      applyChange(
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

  if (willPersist) {
    writeQueue.enqueue(
      () => persistBranchChange(worktree, entry.changeSet, changeDirection),
      onWriteFailure,
    );
  }

  set(sessionHistoryDerivedAtom, sessionHistory);
};

const nextEntry = (
  sessionHistory: SessionHistory,
  direction: "undo" | "redo",
): HistoryEntry | null =>
  direction === "undo" ? sessionHistory.nextUndo() : sessionHistory.nextRedo();

export const useUndoableTransactions = () => {
  const onWriteFailure = useWriteFailureHandler();
  const isPersistScenariosOn = useFeatureFlag("FLAG_PERSIST_SCENARIOS");

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
            isPersistScenariosOn,
            onWriteFailure,
          );
          return true;
        } finally {
          set(historyPendingAtom, false);
        }
      },
      [onWriteFailure, isPersistScenariosOn],
    ),
  );

  return { historyControl };
};
