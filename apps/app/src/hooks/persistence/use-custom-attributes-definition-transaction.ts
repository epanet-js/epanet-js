import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { useAtomCallback } from "jotai/utils";
import {
  type CustomAttributesData,
  type CustomAttributesDefinition,
  getAttributeIds,
  removeAttributes,
} from "@epanet-js/custom-attributes";
import {
  customAttributesDataAtom,
  customAttributesDefinitionAtom,
} from "src/state/custom-attributes";
import { dialogAtom } from "src/state/dialog";
import { saveCustomAttributes, saveCustomAttributesData } from "src/lib/db";
import {
  serializeCustomAttributesData,
  serializeCustomAttributesDefinition,
} from "@epanet-js/ejsdb-mappers";
import { captureError } from "src/infra/error-tracking";

type RemovalEffect = {
  removedAssetIds: Set<number>;
  data: CustomAttributesData;
  changed: boolean;
};

export const useCustomAttributesDefinitionTransaction = () => {
  const setDialog = useSetAtom(dialogAtom);

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

  const applyEffect = useAtomCallback(
    useCallback(
      (
        _get,
        set,
        next: CustomAttributesDefinition,
        effect: RemovalEffect,
      ): void => {
        set(customAttributesDefinitionAtom, next);
        if (effect.changed) {
          set(customAttributesDataAtom, effect.data);
        }
      },
      [],
    ),
  );

  const transact = useCallback(
    async (next: CustomAttributesDefinition): Promise<boolean> => {
      const effect = computeRemoval(next);

      try {
        serializeCustomAttributesDefinition(next);
        if (effect.changed) {
          serializeCustomAttributesData(effect.data, effect.removedAssetIds);
        }
      } catch (error) {
        captureError(error instanceof Error ? error : new Error(String(error)));
        setDialog({ type: "changeNotApplied" });
        return false;
      }

      applyEffect(next, effect);

      await saveCustomAttributes(next);
      if (effect.changed) {
        await saveCustomAttributesData(effect.data, effect.removedAssetIds);
      }

      return true;
    },
    [computeRemoval, applyEffect, setDialog],
  );

  return { transact };
};
