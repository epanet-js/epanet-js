import { useUnsavedChangesCheck } from "./check-unsaved-changes";
import { useImportInp, inpExtension } from "./import-inp";
import { useCallback } from "react";
import { captureError } from "src/infra/error-tracking";
import { OpenInpStarted, useUserTracking } from "src/infra/user-tracking";
import { useFileOpen } from "src/hooks/use-file-open";

export const openInpFromFsShortcut = "ctrl+o";

export const useOpenInpFromFs = () => {
  const checkUnsavedChanges = useUnsavedChangesCheck();
  const importInp = useImportInp();
  const userTracking = useUserTracking();
  const { openFile, isReady } = useFileOpen();

  const openInpFromFs = useCallback(
    async ({ source }: { source: string }) => {
      userTracking.capture({
        name: "openInp.started",
        source,
      });

      if (!isReady) throw new Error("FS not ready");
      try {
        const file = await openFile({
          multiple: false,
          extensions: [inpExtension],
          description: ".INP",
        });

        if (!file) {
          return;
        }

        void importInp([file]);
      } catch (error) {
        handleFileOpenError(error as Error);
      }
    },
    [openFile, isReady, importInp, userTracking],
  );

  return useCallback(
    ({ source }: { source: OpenInpStarted["source"] }) => {
      checkUnsavedChanges(() => openInpFromFs({ source }));
    },
    [openInpFromFs, checkUnsavedChanges],
  );
};

const handleFileOpenError = (error: Error) => {
  captureError(error);
};
