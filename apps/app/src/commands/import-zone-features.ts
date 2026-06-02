import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { zonesAtom } from "src/state/zones";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { importZoneFeatures } from "src/lib/zones";
import type { ZoneFeature, ImportZoneFeaturesResult } from "src/lib/zones";
import * as db from "src/lib/db";

export const useImportZoneFeatures = () => {
  const setZones = useSetAtom(zonesAtom);
  const isOurFileOn = useFeatureFlag("FLAG_OUR_FILE");

  const importFeatures = useCallback(
    async (
      features: ZoneFeature[],
      labelProperty?: string,
    ): Promise<ImportZoneFeaturesResult> => {
      const result = importZoneFeatures(features, labelProperty);
      setZones(result.zones);

      if (isOurFileOn) {
        await db.saveZones(result.zones);
      }

      return result;
    },
    [setZones, isOurFileOn],
  );

  return importFeatures;
};
