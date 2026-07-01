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
import {
  customAttributesDataAtom,
  customAttributesDefinitionAtom,
} from "src/state/custom-attributes";
import type { ApplyMomentPayload } from "@epanet-js/ejsdb";
import { captureError } from "src/infra/error-tracking";

export const useUndoableTransactions = () => {
  const historyControl = useAtomCallback(
    useCallback((get: Getter, set: Setter, direction: "undo" | "redo") => {
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
          payload = buildMomentPayload(action.moment, {
            data: get(customAttributesDataAtom),
            definition: get(customAttributesDefinitionAtom),
          });
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
      );

      if (payload) {
        void applyMomentToDb(payload).catch(captureError);
      }

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
