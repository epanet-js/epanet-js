import { useCallback } from "react";
import { importZoneFeatures } from "src/lib/zones";
import type { ZoneFeature, ImportZoneFeaturesResult } from "src/lib/zones";
import { useZonesTransaction } from "src/hooks/persistence/use-zones-transaction";

export const useImportZones = () => {
  const { transact } = useZonesTransaction();

  const importZones = useCallback(
    async (
      features: ZoneFeature[],
      labelProperty?: string,
    ): Promise<ImportZoneFeaturesResult | null> => {
      const result = importZoneFeatures(features, labelProperty);

      const applied = await transact(result.zones);
      if (!applied) return null;

      return result;
    },
    [transact],
  );

  return importZones;
};
