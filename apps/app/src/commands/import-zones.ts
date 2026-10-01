import { useCallback } from "react";
import type { BuildZonesResult } from "@epanet-js/converters";
import { useZonesTransaction } from "src/hooks/persistence/use-zones-transaction";

export const useImportZones = () => {
  const { transact } = useZonesTransaction();

  const importZones = useCallback(
    async (built: BuildZonesResult): Promise<BuildZonesResult | null> => {
      const applied = await transact(built.zones);
      if (!applied) return null;

      return built;
    },
    [transact],
  );

  return importZones;
};
