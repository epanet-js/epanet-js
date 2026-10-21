import { useCallback } from "react";
import { useAtomValue } from "jotai";
import type { BuildZonesResult } from "@epanet-js/converters";
import { useZonesTransaction } from "src/hooks/persistence/use-zones-transaction";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { changeZones } from "src/hydraulic-model/model-operations";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";

export const useImportZones = () => {
  const isZonesInModelOn = useFeatureFlag("FLAG_ZONES_IN_MODEL");
  const { transact: transactDeprecated } = useZonesTransaction();
  const { transact } = useModelTransaction();
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);

  const importZones = useCallback(
    async (built: BuildZonesResult): Promise<BuildZonesResult | null> => {
      if (isZonesInModelOn) {
        const changeSet = transact(() =>
          changeZones(hydraulicModel, { zones: built.zones }),
        );
        return changeSet ? built : null;
      }

      const applied = await transactDeprecated(built.zones);
      if (!applied) return null;

      return built;
    },
    [isZonesInModelOn, transact, transactDeprecated, hydraulicModel],
  );

  return importZones;
};
