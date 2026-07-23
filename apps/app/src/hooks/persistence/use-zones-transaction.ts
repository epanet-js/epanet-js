import { useCallback } from "react";
import { useSetAtom } from "jotai";
import type { Zones } from "src/lib/zones";
import { zonesAtom } from "src/state/zones";
import { dialogAtom } from "src/state/dialog";
import { saveZones, serializeZones } from "src/lib/db";
import { captureError } from "src/infra/error-tracking";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { writeQueue } from "src/lib/persistence/write-queue";
import { useWriteFailureHandler } from "src/hooks/persistence/use-write-failure-handler";

export const useZonesTransaction = () => {
  const setZones = useSetAtom(zonesAtom);
  const setDialog = useSetAtom(dialogAtom);
  const isQueueOn = useFeatureFlag("FLAG_TRANSACTIONS_QUEUE");
  const onWriteFailure = useWriteFailureHandler();

  const transact = useCallback(
    async (next: Zones): Promise<boolean> => {
      try {
        serializeZones(next);
      } catch (error) {
        captureError(error instanceof Error ? error : new Error(String(error)));
        setDialog({ type: "changeNotApplied" });
        return false;
      }

      setZones(next);

      if (isQueueOn) {
        writeQueue.enqueue(() => saveZones(next), onWriteFailure);
      } else {
        await saveZones(next);
      }

      return true;
    },
    [setZones, setDialog, isQueueOn, onWriteFailure],
  );

  return { transact };
};
