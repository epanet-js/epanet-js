import { useCallback } from "react";
import { useImportInp } from "src/commands/import-inp";
import { useUnsavedChangesCheck } from "src/commands/check-unsaved-changes";
import { useRecentFiles } from "src/hooks/use-recent-files";
import { captureError } from "src/infra/error-tracking";
import { RecentFileOpened, useUserTracking } from "src/infra/user-tracking";
import type { FileWithHandle } from "browser-fs-access";
import type { RecentFileEntry } from "src/import/recent-files";

export const useOpenRecentFile = () => {
  const importInp = useImportInp();
  const checkUnsavedChanges = useUnsavedChangesCheck();
  const { removeRecent } = useRecentFiles();
  const userTracking = useUserTracking();

  return useCallback(
    (entry: RecentFileEntry, source: RecentFileOpened["source"]) => {
      checkUnsavedChanges(async () => {
        userTracking.capture({ name: "recentFile.opened", source });
        try {
          const permission = await entry.handle.requestPermission({
            mode: "read",
          });
          if (permission !== "granted") return;

          const file = await entry.handle.getFile();
          const fileWithHandle: FileWithHandle = Object.assign(file, {
            handle: entry.handle,
          });
          void importInp([fileWithHandle]);
        } catch (error) {
          captureError(error as Error);
          void removeRecent(entry.id);
        }
      });
    },
    [checkUnsavedChanges, importInp, removeRecent, userTracking],
  );
};
