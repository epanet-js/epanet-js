import { useQuery } from "react-query";
import { useUnsavedChangesCheck } from "./check-unsaved-changes";
import { useImportInp, inpExtension } from "./import-inp";
import { useCallback } from "react";
import { captureError } from "src/infra/error-tracking";
import { OpenInpStarted, useUserTracking } from "src/infra/user-tracking";

export const openInpFromFsShortcut = "ctrl+o";

export const useOpenInpFromFs = () => {
  const checkUnsavedChanges = useUnsavedChangesCheck();
  const importInp = useImportInp();
  const userTracking = useUserTracking();

  const { data: fsAccess } = useQuery("browser-fs-access", async () => {
    return import("browser-fs-access");
  });

  const openInpFromFs = useCallback(
    async ({ source }: { source: OpenInpStarted["source"] }) => {
      userTracking.capture({
        name: "openInp.started",
        source,
      });

      if (!fsAccess) throw new Error("FS not ready");
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
    },
    [fsAccess, importInp, userTracking],
  );

  return useCallback(
    ({ source }: { source: OpenInpStarted["source"] }) => {
      checkUnsavedChanges(() => openInpFromFs({ source }));
    },
    [openInpFromFs, checkUnsavedChanges],
  );
};
