import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { zonesAtom } from "src/state/zones";
import { importZoneFeatures } from "src/lib/zones";
import type { ZoneFeature } from "src/lib/zones";

export const useImportZoneFeatures = () => {
  const setZones = useSetAtom(zonesAtom);
  const importFeatures = useCallback(
    async (features: ZoneFeature[], labelProperty?: string) => {
      const zones = importZoneFeatures(features, labelProperty);
      setZones(zones);
    },
    [setZones],
  );

  return importFeatures;
};
