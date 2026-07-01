import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import {
  type CustomAttributesData,
  type CustomAttributesDefinition,
  type CustomAttributeValues,
  getAttributeIds,
  removeAttributes,
} from "@epanet-js/custom-attributes";
import {
  customAttributesDataAtom,
  customAttributesDefinitionAtom,
} from "src/state/custom-attributes";
import type { CustomAttributeAssetValues } from "src/lib/custom-attributes/moment";
import { useModelTransaction } from "./use-model-transaction";

type RemovalEffect = {
  removedAssetIds: Set<number>;
  data: CustomAttributesData;
  changed: boolean;
};

export const useCustomAttributesDefinitionTransaction = () => {
  const { transact: transactModel } = useModelTransaction();

  const computeRemoval = useAtomCallback(
    useCallback(
      (get, _set, next: CustomAttributesDefinition): RemovalEffect => {
        const previousIds = getAttributeIds(
          get(customAttributesDefinitionAtom),
        );
        const nextIds = getAttributeIds(next);
        const removedIds = new Set(
          [...previousIds].filter((id) => !nextIds.has(id)),
        );

        const previousData = get(customAttributesDataAtom);
        if (removedIds.size === 0) {
          return {
            removedAssetIds: new Set(),
            data: previousData,
            changed: false,
          };
        }

        const removedAssetIds = new Set<number>();
        for (const [assetId, values] of previousData) {
          for (const attributeId of values.keys()) {
            if (removedIds.has(attributeId)) {
              removedAssetIds.add(assetId);
              break;
            }
          }
        }

        const data = removeAttributes(previousData, removedIds);
        return { removedAssetIds, data, changed: true };
      },
      [],
    ),
  );

  const transact = useCallback(
    (next: CustomAttributesDefinition): boolean => {
      const effect = computeRemoval(next);

      const putValues: CustomAttributeAssetValues[] = [];
      if (effect.changed) {
        for (const assetId of effect.removedAssetIds) {
          const values: CustomAttributeValues =
            effect.data.get(assetId) ?? new Map();
          putValues.push({ assetId, values });
        }
      }

      return transactModel({
        note: "Update custom attributes",
        customAttributes: { putDefinition: next, putValues },
      });
    },
    [computeRemoval, transactModel],
  );

  return { transact };
};
