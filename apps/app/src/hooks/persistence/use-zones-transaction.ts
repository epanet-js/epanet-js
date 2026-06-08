import { useCallback } from "react";
import { useSetAtom } from "jotai";
import type { Zones } from "src/lib/zones";
import { zonesAtom } from "src/state/zones";
import { dialogAtom } from "src/state/dialog";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { saveZones, serializeZones } from "src/lib/db";
import { captureError } from "src/infra/error-tracking";

export const useZonesTransaction = () => {
  const setZones = useSetAtom(zonesAtom);
  const setDialog = useSetAtom(dialogAtom);
  const isOurFileOn = useFeatureFlag("FLAG_OUR_FILE");
  const isSchemaFirstOn = useFeatureFlag("FLAG_SCHEMA_FIRST");

  const transact = useCallback(
    async (next: Zones): Promise<boolean> => {
      if (isOurFileOn && isSchemaFirstOn) {
        try {
          serializeZones(next);
        } catch (error) {
          captureError(
            error instanceof Error ? error : new Error(String(error)),
          );
          setDialog({ type: "changeNotApplied" });
          return false;
        }
      }

      setZones(next);

      if (isOurFileOn) {
        await saveZones(next);
      }

      return true;
    },
    [setZones, setDialog, isOurFileOn, isSchemaFirstOn],
  );

  return { transact };
};
