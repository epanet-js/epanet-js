import { useCallback } from "react";
import { useAtomValue } from "jotai";
import type { BuildZonesResult } from "@epanet-js/converters";
import type { CustomAttributesDefinition } from "@epanet-js/hydraulic-model";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import {
  changeCustomAttributesDefinition,
  changeZones,
  mergeChangeSets,
} from "@epanet-js/hydraulic-model-operations";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";

export const useImportZones = () => {
  const { transact } = useModelTransaction();
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);

  const importZones = useCallback(
    (
      built: BuildZonesResult,
      customAttributes?: CustomAttributesDefinition,
    ): Promise<BuildZonesResult | null> => {
      const changeSet = transact(() =>
        mergeChangeSets(
          [
            ...(customAttributes
              ? [
                  changeCustomAttributesDefinition(
                    hydraulicModel,
                    customAttributes,
                  ),
                ]
              : []),
            changeZones(hydraulicModel, { zones: built.zones }),
          ],
          "changeZones",
        ),
      );
      return Promise.resolve(changeSet ? built : null);
    },
    [transact, hydraulicModel],
  );

  return importZones;
};
