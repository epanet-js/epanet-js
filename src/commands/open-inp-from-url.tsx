import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { dialogAtom, type DialogState } from "src/state/dialog";
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
  const dialog = useAtomValue(dialogAtom);
  const checkUnsavedChanges = useUnsavedChangesCheck();
  const userTracking = useUserTracking();
  const importInp = useImportInp();

  const handleDownloadError = useCallback(
    (previousDialog: DialogState) => {
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
      setDialogState(
        previousDialog?.type === "examples"
          ? { type: "examples" }
          : { type: "welcome" },
      );
    },
    [setDialogState, userTracking, translate],
  );

  const openInpFromUrl = useCallback(
    async (url: string) => {
      const previousDialog = dialog;
      try {
        setDialogState({ type: "loading" });

        const response = await fetch(url);
        if (!response.ok) {
          return handleDownloadError(previousDialog);
        }

        const name = parseName(url);
        const inpFile = new File([await response.blob()], name);

        checkUnsavedChanges(() => importInp([inpFile]));
      } catch (error) {
        captureError(error as Error);
        handleDownloadError(previousDialog);
      }
    },
    [
      dialog,
      setDialogState,
      handleDownloadError,
      checkUnsavedChanges,
      importInp,
    ],
  );

  return { openInpFromUrl };
};

const parseName = (url: string): string => {
  const fileNameWithParams = url.split("/").pop();
  if (!fileNameWithParams) return "my-network.inp";

  return fileNameWithParams.split("?")[0];
};
