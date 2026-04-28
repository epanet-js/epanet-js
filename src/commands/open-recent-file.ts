import { useCallback } from "react";
import { useImportInp } from "src/commands/import-inp";
import { projectExtension } from "src/commands/save-project";
import { useOpenProjectFile } from "src/commands/open-project";
import { useUnsavedChangesCheck } from "src/commands/check-unsaved-changes";
import { useRecentFiles } from "src/hooks/use-recent-files";
import { notify } from "src/components/notifications";
import { captureWarning } from "src/infra/error-tracking";
import { RecentFileOpened, useUserTracking } from "src/infra/user-tracking";
import type { FileWithHandle } from "browser-fs-access";
import type { RecentFileEntry } from "src/lib/recent-files";
import { useTranslate } from "src/hooks/use-translate";

export const useOpenRecentFile = () => {
  const translate = useTranslate();
  const importInp = useImportInp();
  const openProjectFile = useOpenProjectFile();
  const checkUnsavedChanges = useUnsavedChangesCheck();
  const { removeRecent } = useRecentFiles();
  const userTracking = useUserTracking();

  return useCallback(
    (entry: RecentFileEntry, source: RecentFileOpened["source"]) => {
      checkUnsavedChanges(async () => {
        try {
          const permission = await entry.handle.requestPermission({
            mode: "read",
          });
          if (permission !== "granted") {
            notify({
              variant: "warning",
              title: translate("recentFilePermissionDenied"),
            });
            return;
          }

          const file = await entry.handle.getFile();
          const fileWithHandle: FileWithHandle = Object.assign(file, {
            handle: entry.handle,
          });
          const isProject = entry.name.toLowerCase().endsWith(projectExtension);
          if (isProject) {
            await openProjectFile(fileWithHandle, source);
          } else {
            void importInp([fileWithHandle], source);
          }
          userTracking.capture({
            name: "recentFile.opened",
            source,
            filename: entry.name,
            kind: isProject ? "project" : "inp",
          });
        } catch (error) {
          notify({
            variant: "error",
            title: translate("couldNotOpenRecentFile"),
          });
          captureWarning("Could not open recent file", error);
          void removeRecent(entry.id);
        }
      });
    },
    [
      checkUnsavedChanges,
      importInp,
      openProjectFile,
      removeRecent,
      translate,
      userTracking,
    ],
  );
};
