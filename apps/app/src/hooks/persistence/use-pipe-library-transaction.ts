import { useCallback } from "react";
import { useSetAtom } from "jotai";
import type { PipeMaterial } from "@epanet-js/pipe-library";
import { pipeMaterialsAtom } from "src/state/pipe-library";
import { dialogAtom } from "src/state/dialog";
import { savePipeLibrary } from "src/lib/db";
import { serializePipeLibrary } from "@epanet-js/ejsdb-mappers";
import { captureError } from "src/infra/error-tracking";

export const usePipeLibraryTransaction = () => {
  const setPipeMaterials = useSetAtom(pipeMaterialsAtom);
  const setDialog = useSetAtom(dialogAtom);

  const transact = useCallback(
    async (next: PipeMaterial[]): Promise<boolean> => {
      try {
        serializePipeLibrary(next);
      } catch (error) {
        captureError(error instanceof Error ? error : new Error(String(error)));
        setDialog({ type: "changeNotApplied" });
        return false;
      }

      setPipeMaterials(next);

      await savePipeLibrary(next);

      return true;
    },
    [setPipeMaterials, setDialog],
  );

  return { transact };
};
