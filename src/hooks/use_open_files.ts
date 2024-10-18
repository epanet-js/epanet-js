import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { dialogAtom } from "src/state/jotai";
import { groupFiles } from "src/lib/group_files";
import { useQuery } from "react-query";
import {captureError} from "src/infra/error-tracking";

export function useOpenFiles() {
  const setDialogState = useSetAtom(dialogAtom);

  const { data: fsAccess } = useQuery("browser-fs-access", async () => {
    return import("browser-fs-access");
  });

  return useCallback(() => {
    if (!fsAccess) throw new Error("Sorry, still loading");
    return fsAccess
      .fileOpen({ multiple: true, description: "Open files…" })
      .then((f) => {
        const files = groupFiles(f);
        setDialogState({
          type: "import",
          files,
        });
      })
      .catch((e) => {
        captureError(e);
      });
  }, [setDialogState, fsAccess]);
}
