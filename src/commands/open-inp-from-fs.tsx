import { useQuery } from "react-query";
import { useUnsavedChangesCheck } from "./check-unsaved-changes";
import { useImportInp, inpExtension } from "./import-inp";
import { useCallback } from "react";
import { captureError } from "src/infra/error-tracking";

export const openInpFromFsShortcut = "ctrl+o";

export const useOpenInpFromFs = () => {
  const checkUnsavedChanges = useUnsavedChangesCheck();
  const importInp = useImportInp();

  const { data: fsAccess } = useQuery("browser-fs-access", async () => {
    return import("browser-fs-access");
  });

  const openInpFromFs = useCallback(async () => {
    if (!fsAccess) throw new Error("Sorry, still loading");
    try {
      const file = await fsAccess.fileOpen({
        multiple: false,
        extensions: [inpExtension],
        description: ".INP",
      });
      void importInp([file]);
    } catch (error) {
      captureError(error as Error);
    }
  }, [fsAccess, importInp]);

  return useCallback(() => {
    checkUnsavedChanges(openInpFromFs);
  }, [openInpFromFs, checkUnsavedChanges]);
};
