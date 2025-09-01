import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { dialogAtom } from "src/state/dialog";
import { useImportInp } from "./import-inp";
import { captureError } from "src/infra/error-tracking";
import { useTranslate } from "src/hooks/use-translate";
import { useUnsavedChangesCheck } from "./check-unsaved-changes";
import { useUserTracking } from "src/infra/user-tracking";
import { LinkBreak1Icon } from "@radix-ui/react-icons";
import { notify } from "src/components/notifications";
import { Link2Off } from "lucide-react";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export const useOpenInpFromUrl = () => {
  const translate = useTranslate();
  const setDialogState = useSetAtom(dialogAtom);
  const checkUnsavedChanges = useUnsavedChangesCheck();
  const userTracking = useUserTracking();
  const importInp = useImportInp();
  const isLucideIconsOn = useFeatureFlag("FLAG_LUCIDE_ICONS");

  const handleDownloadError = useCallback(() => {
    notify({
      Icon: isLucideIconsOn ? Link2Off : LinkBreak1Icon,
      variant: "error",
      title: translate("downloadFailed"),
      description: translate("checkConnectionAndTry"),
      size: "md",
      isLucideIconsOn: isLucideIconsOn,
    });
    userTracking.capture({
      name: "downloadError.seen",
    });
    setDialogState({ type: "welcome" });
  }, [setDialogState, userTracking, translate, isLucideIconsOn]);

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
