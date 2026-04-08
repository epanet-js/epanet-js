import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import { nanoid } from "nanoid";
import type { ModelMoment } from "src/hydraulic-model";
import { momentLogAtom } from "src/state/model-changes";
import { mapSyncMomentAtom } from "src/state/map";
import {
  stagingModelDerivedAtom,
  momentLogDerivedAtom,
} from "src/state/derived-branch-state";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { trackMoment } from "src/lib/persistence/shared";
import {
  applyMoment,
  computeSyncMoment,
  syncSnapshotMomentLog,
  updateModelCache,
  syncBranchState,
} from "src/lib/persistence/transaction-helpers";

export const useModelTransaction = () => {
  const isStateRefactorOn = useFeatureFlag("FLAG_STATE_REFACTOR");

  const transact = useAtomCallback(
    useCallback(
      (get: Getter, set: Setter, moment: ModelMoment) => {
        if (isStateRefactorOn) {
          const momentLog = get(momentLogDerivedAtom).copy();
          const mapSyncMoment = get(mapSyncMomentAtom);
          const isTruncatingHistory = momentLog.nextRedo() !== null;

          trackMoment(moment);
          const newStateId = nanoid();

          const reverseMoment = applyMoment(
            get,
            set,
            newStateId,
            moment,
            stagingModelDerivedAtom,
          );

          momentLog.append(moment, reverseMoment, newStateId);

          const newMapSyncMoment = computeSyncMoment(
            mapSyncMoment,
            momentLog,
            isTruncatingHistory,
          );

          set(momentLogDerivedAtom, momentLog);
          set(mapSyncMomentAtom, newMapSyncMoment);
        } else {
          const momentLog = get(momentLogAtom).copy();
          const mapSyncMoment = get(mapSyncMomentAtom);
          const isTruncatingHistory = momentLog.nextRedo() !== null;

          trackMoment(moment);
          const newStateId = nanoid();

          const reverseMoment = applyMoment(get, set, newStateId, moment);

          momentLog.append(moment, reverseMoment, newStateId);

          const newMapSyncMoment = computeSyncMoment(
            mapSyncMoment,
            momentLog,
            isTruncatingHistory,
          );

          set(momentLogAtom, momentLog);
          set(mapSyncMomentAtom, newMapSyncMoment);
          syncSnapshotMomentLog(get, set, momentLog, newStateId);
          updateModelCache(get, set);
          syncBranchState(get, set, momentLog, newStateId);
        }
      },
      [isStateRefactorOn],
    ),
  );

  return { transact };
};
