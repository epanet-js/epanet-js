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
import { trackMoment } from "src/lib/persistence/shared";
import {
  applyMoment,
  computeSyncMoment,
} from "src/lib/persistence/transaction-helpers";

export const useModelTransaction = () => {
  const transact = useAtomCallback(
    useCallback((get: Getter, set: Setter, moment: ModelMoment) => {
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
    }, []),
  );

  return { transact };
};
