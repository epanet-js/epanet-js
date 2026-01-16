import { useUnsavedChangesCheck } from "./check-unsaved-changes";
import { useImportInp } from "./import-inp";
import { useCallback } from "react";
import { captureError } from "src/infra/error-tracking";
import { useFileOpen } from "src/hooks/use-file-open";
import { useLegitFs } from "src/components/legit-fs-provider";

export const useOpenArchiveFromFs = () => {
  const checkUnsavedChanges = useUnsavedChangesCheck();
  const legitFs = useLegitFs();
  const { reloadFromVersionedFs } = useImportInp();
  const { openFile, isReady } = useFileOpen();

  const openArchiveFromFs = useCallback(async () => {
    if (!isReady) throw new Error("FS not ready");
    try {
      const file = await openFile({
        multiple: false,
        extensions: [".zip"],
        description: ".ZIP",
      });

      if (!file) {
        return;
      }

      // Load the archive into the versioned filesystem
      if (!legitFs) {
        throw new Error("Versioned filesystem not available");
      }

      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      await legitFs.loadArchive({
        legitArchive: uint8Array,
        clearExisting: true,
      });
      await legitFs.setCurrentBranch("main");
      void reloadFromVersionedFs(file.name);
    } catch (error) {
      captureError(error as Error);
    }
  }, [openFile, isReady, legitFs, reloadFromVersionedFs]);

  return useCallback(() => {
    checkUnsavedChanges(() => openArchiveFromFs());
  }, [openArchiveFromFs, checkUnsavedChanges]);
};
