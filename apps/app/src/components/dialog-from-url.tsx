import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { useSearchParams } from "next/navigation";
import { captureWarning } from "src/infra/error-tracking";
import { dialogAtom, parseUrlDialog } from "src/state/dialog";

const dialogParam = "dialog";

const removeDialogParam = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete(dialogParam);
  window.history.replaceState({}, "", url);
};

export const DialogFromUrl = () => {
  const dialogType = useSearchParams().get(dialogParam);
  const setDialogState = useSetAtom(dialogAtom);

  useEffect(() => {
    if (!dialogType) return;
    const dialog = parseUrlDialog(dialogType);
    if (dialog) setDialogState(dialog);
    else captureWarning(`Unknown dialog in URL: ${dialogType}`);
    removeDialogParam();
  }, [dialogType, setDialogState]);

  return null;
};
