import { useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { dialogAtom, hasUnsavedChangesAtom } from "src/state/jotai";
import { groupFiles } from "src/lib/group_files";
import { useQuery } from "react-query";
import { captureError } from "src/infra/error-tracking";
import toast from "react-hot-toast";
import { FileWithHandle } from "browser-fs-access";
import { translate } from "src/infra/i18n";

const inpExtension = ".inp";

export const useOpenInp = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const hasUnsavedChanges = useAtomValue(hasUnsavedChangesAtom);

  const { data: fsAccess } = useQuery("browser-fs-access", async () => {
    return import("browser-fs-access");
  });

  const findInpInFs = useCallback(async () => {
    if (!fsAccess) throw new Error("Sorry, still loading");
    try {
      const file = await fsAccess.fileOpen({
        multiple: false,
        extensions: [inpExtension],
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

  const openInpFromFs = useCallback(() => {
    if (hasUnsavedChanges) {
      return setDialogState({
        type: "unsavedChanges",
        onContinue: findInpInFs,
      });
    }

    void findInpInFs();
  }, [findInpInFs, setDialogState, hasUnsavedChanges]);

  const findInpInCandidates = useCallback(
    (candidates: FileWithHandle[]) => {
      const inps = candidates.filter((file) =>
        file.name.toLowerCase().endsWith(inpExtension),
      );

      if (!inps.length) {
        toast.error(translate("inpMissing"));
        return;
      }

      const files = groupFiles([inps[0]]);
      setDialogState({
        type: "openInp",
        files,
      });
    },
    [setDialogState],
  );

  const openInpFromCandidates = useCallback(
    (candidates: FileWithHandle[]) => {
      if (hasUnsavedChanges) {
        return setDialogState({
          type: "unsavedChanges",
          onContinue: () => findInpInCandidates(candidates),
        });
      }

      findInpInCandidates(candidates);
    },
    [setDialogState, hasUnsavedChanges, findInpInCandidates],
  );

  return { openInpFromCandidates, openInpFromFs };
};
