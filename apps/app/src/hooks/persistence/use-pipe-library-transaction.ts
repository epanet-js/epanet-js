import { useCallback } from "react";
import { useSetAtom } from "jotai";
import type { PipeMaterial } from "src/lib/pipe-library";
import { pipeMaterialsAtom } from "src/state/pipe-library";
import { dialogAtom } from "src/state/dialog";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { savePipeLibrary, serializePipeLibrary } from "src/lib/db";
import { captureError } from "src/infra/error-tracking";

export const usePipeLibraryTransaction = () => {
  const setPipeMaterials = useSetAtom(pipeMaterialsAtom);
  const setDialog = useSetAtom(dialogAtom);
  const isSchemaFirstOn = useFeatureFlag("FLAG_SCHEMA_FIRST");

  const transact = useCallback(
    async (next: PipeMaterial[]): Promise<boolean> => {
      if (isSchemaFirstOn) {
        try {
          serializePipeLibrary(next);
        } catch (error) {
          captureError(
            error instanceof Error ? error : new Error(String(error)),
          );
          setDialog({ type: "changeNotApplied" });
          return false;
        }
      }

      setPipeMaterials(next);

      await savePipeLibrary(next);

      return true;
    },
    [setPipeMaterials, setDialog, isSchemaFirstOn],
  );

  return { transact };
};
