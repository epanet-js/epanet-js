import { useCallback } from "react";
import { useAtomValue } from "jotai";
import type { BuildZonesResult } from "@epanet-js/converters";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import { changeZones } from "@epanet-js/hydraulic-model-operations";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";

export const useImportZones = () => {
  const { transact } = useModelTransaction();
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);

  const importZones = useCallback(
    (built: BuildZonesResult): Promise<BuildZonesResult | null> => {
      const changeSet = transact(() =>
        changeZones(hydraulicModel, { zones: built.zones }),
      );
      return Promise.resolve(changeSet ? built : null);
    },
    [transact, hydraulicModel],
  );

  return importZones;
};
