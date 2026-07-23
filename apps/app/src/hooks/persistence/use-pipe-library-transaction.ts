import { useCallback } from "react";
import { useSetAtom } from "jotai";
import type { PipeMaterial } from "@epanet-js/pipe-library";
import { pipeMaterialsAtom } from "src/state/pipe-library";
import { dialogAtom } from "src/state/dialog";
import { savePipeLibrary } from "src/lib/db";
import { serializePipeLibrary } from "@epanet-js/ejsdb-mappers";
import { captureError } from "src/infra/error-tracking";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { writeQueue } from "src/lib/persistence/write-queue";
import { useWriteFailureHandler } from "src/hooks/persistence/use-write-failure-handler";

export const usePipeLibraryTransaction = () => {
  const setPipeMaterials = useSetAtom(pipeMaterialsAtom);
  const setDialog = useSetAtom(dialogAtom);
  const isQueueOn = useFeatureFlag("FLAG_TRANSACTIONS_QUEUE");
  const onWriteFailure = useWriteFailureHandler();

  const transact = useCallback(
    async (next: PipeMaterial[]): Promise<boolean> => {
      try {
        serializePipeLibrary(next);
      } catch (error) {
        captureError(error instanceof Error ? error : new Error(String(error)));
        setDialog({ type: "changeNotApplied" });
        return false;
      }

      setPipeMaterials(next);

      if (isQueueOn) {
        writeQueue.enqueue(() => savePipeLibrary(next), onWriteFailure);
      } else {
        await savePipeLibrary(next);
      }

      return true;
    },
    [setPipeMaterials, setDialog, isQueueOn, onWriteFailure],
  );

  return { transact };
};
