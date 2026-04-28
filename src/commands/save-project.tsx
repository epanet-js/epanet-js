import { useCallback, useContext } from "react";
import { useAtomCallback } from "jotai/utils";
import type { fileSave as fileSaveType } from "browser-fs-access";

import {
  inpFileInfoAtom,
  projectFileInfoAtom,
  isDemoNetworkAtom,
} from "src/state/file-system";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { dialogAtom } from "src/state/dialog";
import { userSettingsAtom } from "src/state/user-settings";
import { projectSettingsAtom } from "src/state/project-settings";
import { notify } from "src/components/notifications";
import { SpinnerIcon, SuccessIcon, WarningIcon } from "src/icons";
import { useTranslate } from "src/hooks/use-translate";
import { useRecentFiles } from "src/hooks/use-recent-files";
import { useUserTracking } from "src/infra/user-tracking";
import * as db from "src/lib/db";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { captureError } from "src/infra/error-tracking";
import { MapContext, captureThumbnail } from "src/map";

export const saveProjectShortcut = "ctrl+s";
export const saveProjectAsShortcut = "ctrl+shift+s";
export const projectExtension = ".ejsdb";

const saveProjectToastId = "save-project";

type FileAccess = { fileSave: typeof fileSaveType };

const getDefaultFsAccess = async (): Promise<FileAccess> => {
  const { fileSave } = await import("browser-fs-access");
  return { fileSave };
};

export const useSaveProject = ({
  getFsAccess = getDefaultFsAccess,
}: { getFsAccess?: () => Promise<FileAccess> } = {}) => {
  const translate = useTranslate();
  const { addRecent } = useRecentFiles();
  const userTracking = useUserTracking();
  const isOurFileOn = useFeatureFlag("FLAG_OUR_FILE");
  const map = useContext(MapContext);

  const performSave = useAtomCallback(
    useCallback(
      async (get, set, { isSaveAs = false }: { isSaveAs?: boolean }) => {
        const asyncSave = async () => {
          const { fileSave } = await getFsAccess();
          const projectInfo = get(projectFileInfoAtom);
          const inpInfo = get(inpFileInfoAtom);
          const hydraulicModel = get(stagingModelDerivedAtom);

          const suggestedName = projectInfo
            ? projectInfo.name
            : inpInfo
              ? `${inpInfo.name.replace(/\.[^.]+$/, "")}${projectExtension}`
              : `my-project${projectExtension}`;

          const blob = await db.exportDb();
          const newHandle = await fileSave(
            blob,
            {
              fileName: suggestedName,
              extensions: [projectExtension],
              description: "EPANET project",
              mimeTypes: ["application/octet-stream"],
            },
            projectInfo && !isSaveAs
              ? (projectInfo.handle as FileSystemFileHandle)
              : null,
          );

          if (newHandle) {
            const projectName = newHandle.name.replace(/\.[^.]+$/, "");
            const updatedSettings = {
              ...get(projectSettingsAtom),
              name: projectName,
            };
            set(projectSettingsAtom, updatedSettings);

            try {
              await db.saveProjectSettings(updatedSettings);
              const updatedBlob = await db.exportDb();
              const writable = await newHandle.createWritable();
              await writable.write(updatedBlob);
              await writable.close();
            } catch (error) {
              captureError(error as Error);
            }

            const isDemo = get(isDemoNetworkAtom);
            set(projectFileInfoAtom, {
              name: newHandle.name,
              modelVersion: hydraulicModel.version,
              handle: newHandle,
            });
            if (!isDemo) {
              const thumbnail = map
                ? (captureThumbnail(map) ?? undefined)
                : undefined;
              void addRecent(newHandle.name, newHandle, thumbnail);
            }
          }
        };

        notify({
          variant: "default",
          title: translate("savingProject"),
          Icon: SpinnerIcon,
          id: saveProjectToastId,
          size: "sm",
          dismissable: false,
          duration: Infinity,
        });
        try {
          await asyncSave();
          notify({
            variant: "success",
            title: translate("saved"),
            Icon: SuccessIcon,
            id: saveProjectToastId,
            size: "sm",
          });
          return true;
        } catch {
          notify({
            variant: "warning",
            title: translate("saveCanceled"),
            Icon: WarningIcon,
            id: saveProjectToastId,
            size: "sm",
          });
          return false;
        }
      },
      [getFsAccess, addRecent, translate, map],
    ),
  );

  return useAtomCallback(
    useCallback(
      async (
        get,
        set,
        { source, isSaveAs = false }: { source: string; isSaveAs?: boolean },
      ) => {
        if (!isOurFileOn) return false;

        userTracking.capture({ name: "project.saved", source, isSaveAs });

        const projectInfo = get(projectFileInfoAtom);
        if (!projectInfo && get(userSettingsAtom).showProjectSavedInfo) {
          return new Promise<boolean>((resolve) => {
            set(dialogAtom, {
              type: "projectSavedInfo",
              onConfirm: () => {
                void performSave({ isSaveAs }).then(resolve);
              },
              onCancel: () => resolve(false),
            });
          });
        }

        return performSave({ isSaveAs });
      },
      [performSave, isOurFileOn, userTracking],
    ),
  );
};
