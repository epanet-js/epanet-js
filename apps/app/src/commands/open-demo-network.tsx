import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { dialogAtom } from "src/state/dialog";
import { useOpenProjectFile } from "./open-project";
import { captureError } from "src/infra/error-tracking";
import { useTranslate } from "src/hooks/use-translate";
import { useUnsavedChangesCheck } from "./check-unsaved-changes";
import { useUserTracking } from "src/infra/user-tracking";
import { notify } from "src/components/notifications";
import { DisconnectIcon } from "src/icons";

export const useOpenDemoNetwork = () => {
  const translate = useTranslate();
  const setDialogState = useSetAtom(dialogAtom);
  const checkUnsavedChanges = useUnsavedChangesCheck();
  const userTracking = useUserTracking();
  const openProjectFile = useOpenProjectFile();

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

  const openDemoNetwork = useCallback(
    async (url: string) => {
      try {
        setDialogState({ type: "loading" });

        const response = await fetch(url);
        if (!response.ok) {
          return handleDownloadError();
        }

        const name = parseName(url);
        const file = new File([await response.blob()], name);

        checkUnsavedChanges(() =>
          openProjectFile(file, "exampleModel", { isDemoNetwork: true }),
        );
      } catch (error) {
        captureError(error as Error);
        handleDownloadError();
      }
    },
    [setDialogState, handleDownloadError, checkUnsavedChanges, openProjectFile],
  );

  return { openDemoNetwork };
};

const parseName = (url: string): string => {
  const fileNameWithParams = url.split("/").pop();
  if (!fileNameWithParams) return "demo-network.ejsdb";

  return fileNameWithParams.split("?")[0];
};
