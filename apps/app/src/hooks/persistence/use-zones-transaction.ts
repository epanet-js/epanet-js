import { useCallback } from "react";
import { useSetAtom } from "jotai";
import type { Zones } from "src/lib/zones";
import { zonesAtom } from "src/state/zones";
import { dialogAtom } from "src/state/dialog";
import { saveZones, serializeZones } from "src/lib/db";
import { captureError } from "src/infra/error-tracking";

export const useZonesTransaction = () => {
  const setZones = useSetAtom(zonesAtom);
  const setDialog = useSetAtom(dialogAtom);

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

      await saveZones(next);

      return true;
    },
    [setZones, setDialog],
  );

  return { transact };
};
