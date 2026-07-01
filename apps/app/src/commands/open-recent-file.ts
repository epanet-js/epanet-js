import { useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
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
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { dialogAtom } from "src/state/dialog";
import { userSettingsAtom } from "src/state/user-settings";

export const useOpenRecentFile = () => {
  const translate = useTranslate();
  const importInp = useImportInp();
  const openProjectFile = useOpenProjectFile();
  const checkUnsavedChanges = useUnsavedChangesCheck();
  const { removeRecent } = useRecentFiles();
  const userTracking = useUserTracking();
  const isFilePermissionsFlagOn = useFeatureFlag("FLAG_FILE_PERMISSIONS");
  const setDialogState = useSetAtom(dialogAtom);
  const userSettings = useAtomValue(userSettingsAtom);

  return useCallback(
    (entry: RecentFileEntry, source: RecentFileOpened["source"]) => {
      const proceedToOpen = async () => {
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
            await importInp([fileWithHandle], source);
          }
          userTracking.capture({
            name: "recentFile.opened",
            source,
            filename: entry.name,
            kind: isProject ? "project" : "inp",
          });
        } catch (error) {
          const err = error as Error;
          if (err.name === "NotAllowedError") {
            notify({
              variant: "warning",
              title: translate("recentFilePermissionDenied"),
            });
            if (!isFilePermissionsFlagOn) {
              captureWarning("Recent file: permission denied", err);
            }
            return;
          }
          if (err.name === "NotFoundError") {
            notify({
              variant: "warning",
              title: translate("recentFileNotFound"),
            });
            captureWarning("Recent file: not found", err);
            void removeRecent(entry.id);
            return;
          }
          notify({
            variant: "error",
            title: translate("couldNotOpenRecentFile"),
          });
          captureWarning("Could not open recent file", err);
          void removeRecent(entry.id);
        }
      };

      checkUnsavedChanges(async () => {
        const permissionState = await entry.handle.queryPermission({
          mode: "read",
        });
        const willPrompt = permissionState === "prompt";

        if (
          isFilePermissionsFlagOn &&
          userSettings.showFilePermissionsInfo &&
          willPrompt
        ) {
          setDialogState({
            type: "filePermissionsInfo",
            onAcknowledge: () => {
              void proceedToOpen();
            },
          });
          return;
        }

        await proceedToOpen();
      });
    },
    [
      checkUnsavedChanges,
      importInp,
      openProjectFile,
      removeRecent,
      translate,
      userTracking,
      isFilePermissionsFlagOn,
      setDialogState,
      userSettings.showFilePermissionsInfo,
    ],
  );
};
