import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { dialogAtom } from "src/state/dialog";
import { useImportInp } from "./import-inp";
import { captureError } from "src/infra/error-tracking";
import { useTranslate } from "src/hooks/use-translate";
import { useUnsavedChangesCheck } from "./check-unsaved-changes";
import { useUserTracking } from "src/infra/user-tracking";
import { notify } from "src/components/notifications";
import { DisconnectIcon } from "src/icons";

export const useOpenInpFromUrl = () => {
  const translate = useTranslate();
  const setDialogState = useSetAtom(dialogAtom);
  const checkUnsavedChanges = useUnsavedChangesCheck();
  const userTracking = useUserTracking();
  const importInp = useImportInp();

  const handleDownloadError = useCallback(() => {
    notify({
      Icon: DisconnectIcon,
      variant: "error",
      title: translate("downloadFailed"),
      description: translate("checkConnectionAndTry"),
      size: "md",
    });
    userTracking.capture({
      name: "downloadError.seen",
    });
    setDialogState({ type: "welcome" });
  }, [setDialogState, userTracking, translate]);

  const openInpFromUrl = useCallback(
    async (url: string) => {
      try {
        setDialogState({ type: "loading" });

        const response = await fetch(url);
        if (!response.ok) {
          return handleDownloadError();
        }

        const name = parseName(url);
        const inpFile = new File([await response.blob()], name);

        checkUnsavedChanges(() => importInp([inpFile]));
      } catch (error) {
        captureError(error as Error);
        handleDownloadError();
      }
    },
    [setDialogState, handleDownloadError, checkUnsavedChanges, importInp],
  );

  return { openInpFromUrl };
};

const parseName = (url: string): string => {
  const fileNameWithParams = url.split("/").pop();
  if (!fileNameWithParams) return "my-network.inp";

  return fileNameWithParams.split("?")[0];
};
