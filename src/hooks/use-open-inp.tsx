import { useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { dialogAtom, hasUnsavedChangesAtom } from "src/state/jotai";
import { groupFiles } from "src/lib/group_files";
import { useQuery } from "react-query";
import { captureError } from "src/infra/error-tracking";

export const useOpenInp = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const hasUnsavedChanges = useAtomValue(hasUnsavedChangesAtom);

  const { data: fsAccess } = useQuery("browser-fs-access", async () => {
    return import("browser-fs-access");
  });

  const openInp = useCallback(async () => {
    if (!fsAccess) throw new Error("Sorry, still loading");
    try {
      const file = await fsAccess.fileOpen({
        multiple: false,
        extensions: [".inp"],
        description: ".INP",
      });
      const files = groupFiles([file]);
      setDialogState({
        type: "openInp",
        files,
      });
    } catch (error) {
      captureError(error as Error);
    }
  }, [fsAccess, setDialogState]);

  return useCallback(() => {
    if (hasUnsavedChanges) {
      return setDialogState({ type: "unsavedChanges", onContinue: openInp });
    }

    void openInp();
  }, [openInp, setDialogState, hasUnsavedChanges]);
};
