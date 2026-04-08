import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import { nanoid } from "nanoid";
import type { ModelMoment } from "src/hydraulic-model";
import { momentLogAtom } from "src/state/model-changes";
import { mapSyncMomentAtom } from "src/state/map";
import { trackMoment } from "src/lib/persistence/shared";
import {
  applyMoment,
  computeSyncMoment,
  syncSnapshotMomentLog,
  updateModelCache,
  syncBranchState,
} from "src/lib/persistence/transaction-helpers";

export const useModelTransaction = () => {
  const transact = useAtomCallback(
    useCallback((get: Getter, set: Setter, moment: ModelMoment) => {
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
    }, []),
  );

  return { transact };
};
