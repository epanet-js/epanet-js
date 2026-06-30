import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { useAtomCallback } from "jotai/utils";
import {
  type CustomAttributesDefinition,
  getAttributeIds,
  removeAttributes,
} from "@epanet-js/custom-attributes";
import {
  customAttributesDataAtom,
  customAttributesDefinitionAtom,
} from "src/state/custom-attributes";
import { dialogAtom } from "src/state/dialog";
import { saveCustomAttributes } from "src/lib/db";
import { serializeCustomAttributesDefinition } from "@epanet-js/ejsdb-mappers";
import { captureError } from "src/infra/error-tracking";

export const useCustomAttributesDefinitionTransaction = () => {
  const setDialog = useSetAtom(dialogAtom);

  const apply = useAtomCallback(
    useCallback((get, set, next: CustomAttributesDefinition) => {
      const previousIds = getAttributeIds(get(customAttributesDefinitionAtom));
      const nextIds = getAttributeIds(next);
      const removedIds = new Set(
        [...previousIds].filter((id) => !nextIds.has(id)),
      );

      set(customAttributesDefinitionAtom, next);

      if (removedIds.size > 0) {
        set(
          customAttributesDataAtom,
          removeAttributes(get(customAttributesDataAtom), removedIds),
        );
      }
    }, []),
  );

  const transact = useCallback(
    async (next: CustomAttributesDefinition): Promise<boolean> => {
      try {
        serializeCustomAttributesDefinition(next);
      } catch (error) {
        captureError(error instanceof Error ? error : new Error(String(error)));
        setDialog({ type: "changeNotApplied" });
        return false;
      }

      apply(next);

      await saveCustomAttributes(next);

      return true;
    },
    [apply, setDialog],
  );

  return { transact };
};
