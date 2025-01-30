import { useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { dialogAtom, hasUnsavedChangesAtom } from "src/state/jotai";
import { groupFiles } from "src/lib/group_files";
import { useQuery } from "react-query";
import { captureError } from "src/infra/error-tracking";
import { isFeatureOn } from "src/infra/feature-flags";

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
  }, [fsAccess]);

  return useCallback(() => {
    if (isFeatureOn("FLAG_UNSAVED") && hasUnsavedChanges) {
      return setDialogState({ type: "unsavedChanges", onContinue: openInp });
    }

    openInp();
  }, [setDialogState, fsAccess, hasUnsavedChanges]);
};
