import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { nanoid } from "nanoid";
import type { Zones } from "src/lib/zones";
import { zonesAtom } from "src/state/zones";
import { projectDataVersionAtom } from "src/state/project-revision";
import { dialogAtom } from "src/state/dialog";
import { saveZones, serializeZones } from "src/lib/db";
import { captureError } from "src/infra/error-tracking";
import { writeQueue } from "src/lib/persistence/write-queue";
import { useWriteFailureHandler } from "src/hooks/persistence/use-write-failure-handler";

export const useZonesTransaction = () => {
  const setZones = useSetAtom(zonesAtom);
  const setProjectDataVersion = useSetAtom(projectDataVersionAtom);
  const setDialog = useSetAtom(dialogAtom);
  const onWriteFailure = useWriteFailureHandler();

  const transact = useCallback(
    (next: Zones): Promise<boolean> => {
      try {
        serializeZones(next);
      } catch (error) {
        captureError(error instanceof Error ? error : new Error(String(error)));
        setDialog({ type: "changeNotApplied" });
        return Promise.resolve(false);
      }

      setZones(next);
      setProjectDataVersion(nanoid());

      writeQueue.enqueue(() => saveZones(next), onWriteFailure);

      return Promise.resolve(true);
    },
    [setZones, setProjectDataVersion, setDialog, onWriteFailure],
  );

  return { transact };
};
