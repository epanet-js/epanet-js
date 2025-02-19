import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { dialogAtom } from "src/state/dialog_state";
import { useOpenInp } from "./open-inp";
import toast from "react-hot-toast";
import { captureError } from "src/infra/error-tracking";
import { translate } from "src/infra/i18n";

export const useOpenInpFromUrl = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const { openInpFromCandidates } = useOpenInp();

  const handleDownloadError = useCallback(() => {
    toast.error(translate("downloadFailed"));
    setDialogState({ type: "welcome" });
  }, [setDialogState]);

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
        openInpFromCandidates([inpFile]);
      } catch (error) {
        captureError(error as Error);
        handleDownloadError();
      }
    },
    [setDialogState, handleDownloadError],
  );

  return { openInpFromUrl };
};

const parseName = (url: string): string => {
  const fileNameWithParams = url.split("/").pop();
  if (!fileNameWithParams) return "my-network.inp";

  return fileNameWithParams.split("?")[0];
};
