import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import { nanoid } from "nanoid";
import type { ChangeSet } from "@epanet-js/change-set";
import { timedSync } from "@epanet-js/ejsdb";
import {
  stagingModelDerivedAtom,
  sessionHistoryDerivedAtom,
} from "src/state/derived-branch-state";
import { worktreeAtom } from "src/state/scenarios";
import { historyPendingAtom } from "src/state/transactions";
import { applyChange } from "src/lib/persistence/transaction-helpers";
import type { PersistBranchChange } from "src/lib/persistence/persist-branch-change";
import { usePersistBranchChange } from "src/hooks/persistence/use-persist-branch-change";
import { trackChangeSet } from "src/lib/persistence/shared";
import { captureWarning } from "src/infra/error-tracking";
import {
  writeQueue,
  type WriteFailureHandler,
} from "src/lib/persistence/write-queue";
import { useWriteFailureHandler } from "src/hooks/persistence/use-write-failure-handler";

export const isHistoryPending = (get: Getter, note: string): boolean => {
  if (!get(historyPendingAtom)) return false;
  captureWarning(`Edit "${note}" rejected: a history action is pending`);
  return true;
};

export const commitChangeSet = (
  get: Getter,
  set: Setter,
  changeSet: ChangeSet,
  onWriteFailure: WriteFailureHandler,
  persist: PersistBranchChange,
): void => {
  const newStateId = nanoid();
  const sessionHistory = get(sessionHistoryDerivedAtom).copy();

  timedSync(
    "changeSet:apply",
    () =>
      applyChange(
        get,
        set,
        newStateId,
        changeSet,
        "forward",
        stagingModelDerivedAtom,
      ),
    { note: changeSet.name },
  );

  sessionHistory.append(changeSet, newStateId);
  set(sessionHistoryDerivedAtom, sessionHistory);

  const worktree = get(worktreeAtom);
  writeQueue.enqueue(
    () => persist(worktree, changeSet, "forward"),
    onWriteFailure,
  );
};

export const useModelTransaction = () => {
  const onWriteFailure = useWriteFailureHandler();
  const persist = usePersistBranchChange();

  const transact = useAtomCallback(
    useCallback(
      (get: Getter, set: Setter, changeSet: ChangeSet) => {
        if (isHistoryPending(get, changeSet.name)) return false;

        trackChangeSet(changeSet);
        commitChangeSet(get, set, changeSet, onWriteFailure, persist);
        return true;
      },
      [onWriteFailure, persist],
    ),
  );

  return { transact };
};
