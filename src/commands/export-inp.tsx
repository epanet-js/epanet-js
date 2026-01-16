import { useUnsavedChangesCheck } from "./check-unsaved-changes";
import { useCallback } from "react";
import { captureError } from "src/infra/error-tracking";
import { useSaveInp } from "./save-inp";

export const useExportInp = () => {
  const checkUnsavedChanges = useUnsavedChangesCheck();
  const saveInp = useSaveInp();

  const exportInp = useCallback(async () => {
    try {
      await saveInp({ source: "toolbar", isSaveAs: true, exportInp: true });
    } catch (error) {
      captureError(error as Error);
    }
  }, [saveInp]);

  return useCallback(() => {
    checkUnsavedChanges(() => exportInp());
  }, [exportInp, checkUnsavedChanges]);
};
