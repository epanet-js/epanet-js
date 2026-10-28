import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { useSearchParams } from "next/navigation";
import { dialogAtom, type DialogState } from "src/state/dialog";

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
    setDialogState({ type: dialogType } as DialogState);
    removeDialogParam();
  }, [dialogType, setDialogState]);

  return null;
};
