import { useCallback } from "react";
import type { ImportZoneFeaturesResult } from "src/lib/zones";
import { useZonesTransaction } from "src/hooks/persistence/use-zones-transaction";

export const useImportZones = () => {
  const { transact } = useZonesTransaction();

  const importZones = useCallback(
    async (
      built: ImportZoneFeaturesResult,
    ): Promise<ImportZoneFeaturesResult | null> => {
      const applied = await transact(built.zones);
      if (!applied) return null;

      return built;
    },
    [transact],
  );

  return importZones;
};
