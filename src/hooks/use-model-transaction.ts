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
} from "src/lib/persistence/transaction-helpers";

export const useModelTransaction = () => {
  const transact = useAtomCallback(
    useCallback((get: Getter, set: Setter, moment: ModelMoment) => {
      const momentLog = get(momentLogAtom).copy();
      const mapSyncMoment = get(mapSyncMomentAtom);

      const isTruncatingHistory = momentLog.nextRedo() !== null;

      trackMoment(moment);
      const {
        note,
        deleteAssets,
        putAssets,
        patchAssetsAttributes,
        ...optionalFields
      } = moment;
      const forwardMoment: ModelMoment = {
        note,
        deleteAssets: deleteAssets || [],
        putAssets: putAssets || [],
        patchAssetsAttributes: patchAssetsAttributes || [],
        ...optionalFields,
      };
      const newStateId = nanoid();

      const reverseMoment = applyMoment(get, set, newStateId, forwardMoment);

      momentLog.append(forwardMoment, reverseMoment, newStateId);

      const newMapSyncMoment = computeSyncMoment(
        mapSyncMoment,
        momentLog,
        isTruncatingHistory,
      );

      set(momentLogAtom, momentLog);
      set(mapSyncMomentAtom, newMapSyncMoment);
      syncSnapshotMomentLog(get, set, momentLog, newStateId);
      updateModelCache(get, set);
    }, []),
  );

  return { transact };
};
