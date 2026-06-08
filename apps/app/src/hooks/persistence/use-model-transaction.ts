import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import { nanoid } from "nanoid";
import type { ModelMoment } from "src/hydraulic-model";
import { mapSyncMomentAtom } from "src/state/map";
import {
  stagingModelDerivedAtom,
  momentLogDerivedAtom,
} from "src/state/derived-branch-state";
import { worktreeAtom } from "src/state/scenarios";
import { dialogAtom } from "src/state/dialog";
import { trackMoment } from "src/lib/persistence/shared";
import {
  applyMoment,
  computeSyncMoment,
} from "src/lib/persistence/transaction-helpers";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { applyMomentToDb, buildMomentPayload } from "src/lib/db";
import type { ApplyMomentPayload } from "@epanet-js/ejsdb";
import { captureError } from "src/infra/error-tracking";

export const useModelTransaction = () => {
  const isSchemaFirstOn = useFeatureFlag("FLAG_SCHEMA_FIRST");
  const transact = useAtomCallback(
    useCallback(
      (get: Getter, set: Setter, moment: ModelMoment) => {
        const momentLog = get(momentLogDerivedAtom).copy();
        const mapSyncMoment = get(mapSyncMomentAtom);
        const isTruncatingHistory = momentLog.nextRedo() !== null;

        const worktree = get(worktreeAtom);
        const willPersist = worktree.activeBranchId === worktree.mainId;

        let payload: ApplyMomentPayload | undefined;
        if (willPersist && isSchemaFirstOn) {
          try {
            payload = buildMomentPayload(moment);
          } catch (error) {
            captureError(
              error instanceof Error ? error : new Error(String(error)),
            );
            set(dialogAtom, { type: "changeNotApplied" });
            return false;
          }
        }

        trackMoment(moment);
        const newStateId = nanoid();

        const reverseMoment = applyMoment(
          get,
          set,
          newStateId,
          moment,
          stagingModelDerivedAtom,
        );

        if (willPersist) {
          if (payload) {
            void applyMomentToDb(payload).catch(captureError);
          } else {
            void (async () =>
              applyMomentToDb(buildMomentPayload(moment)))().catch(
              captureError,
            );
          }
        }

        momentLog.append(moment, reverseMoment, newStateId);

        const newMapSyncMoment = computeSyncMoment(
          mapSyncMoment,
          momentLog,
          isTruncatingHistory,
        );

        set(momentLogDerivedAtom, momentLog);
        set(mapSyncMomentAtom, newMapSyncMoment);

        return true;
      },
      [isSchemaFirstOn],
    ),
  );

  return { transact };
};
