import { useCallback } from "react";
import { useSetAtom } from "jotai";
import type { CustomAttributesDefinition } from "@epanet-js/custom-attributes";
import { customAttributesAtom } from "src/state/custom-attributes";
import { dialogAtom } from "src/state/dialog";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { saveCustomAttributes } from "src/lib/db";
import { serializeCustomAttributesDefinition } from "@epanet-js/ejsdb-mappers";
import { captureError } from "src/infra/error-tracking";

export const useCustomAttributesTransaction = () => {
  const setCustomAttributes = useSetAtom(customAttributesAtom);
  const setDialog = useSetAtom(dialogAtom);
  const isSchemaFirstOn = useFeatureFlag("FLAG_SCHEMA_FIRST");

  const transact = useCallback(
    async (next: CustomAttributesDefinition): Promise<boolean> => {
      if (isSchemaFirstOn) {
        try {
          serializeCustomAttributesDefinition(next);
        } catch (error) {
          captureError(
            error instanceof Error ? error : new Error(String(error)),
          );
          setDialog({ type: "changeNotApplied" });
          return false;
        }
      }

      setCustomAttributes(next);

      await saveCustomAttributes(next);

      return true;
    },
    [setCustomAttributes, setDialog, isSchemaFirstOn],
  );

  return { transact };
};
