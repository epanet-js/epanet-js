import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { fileSave as fileSaveType } from "browser-fs-access";

import { inpFileInfoAtom, isDemoNetworkAtom } from "src/state/file-system";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { notifyPromiseState } from "src/components/notifications";
import { useTranslate } from "src/hooks/use-translate";
import { useRecentFiles } from "src/hooks/use-recent-files";
import { useUserTracking } from "src/infra/user-tracking";
import * as db from "src/db";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export const saveProjectShortcut = "ctrl+s";
export const saveProjectAsShortcut = "ctrl+shift+s";
export const projectExtension = ".ejsdb";

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

  return useAtomCallback(
    useCallback(
      async (
        get,
        set,
        { source, isSaveAs = false }: { source: string; isSaveAs?: boolean },
      ) => {
        userTracking.capture({ name: "project.saved", source, isSaveAs });

        if (!isOurFileOn) return false;

        const asyncSave = async () => {
          const { fileSave } = await getFsAccess();
          const fileInfo = get(inpFileInfoAtom);
          const hydraulicModel = get(stagingModelDerivedAtom);

          const blob = await db.exportDb();
          const newHandle = await fileSave(
            blob,
            {
              fileName: fileInfo
                ? fileInfo.name
                : `my-project${projectExtension}`,
              extensions: [projectExtension],
              description: "EPANET project",
              mimeTypes: ["application/octet-stream"],
            },
            fileInfo && !isSaveAs
              ? (fileInfo.handle as FileSystemFileHandle)
              : null,
          );

          if (newHandle) {
            const isDemo = get(isDemoNetworkAtom);
            set(inpFileInfoAtom, {
              name: newHandle.name,
              modelVersion: hydraulicModel.version,
              handle: newHandle,
              options: { type: "inp", folderId: "" },
              isMadeByApp: true,
              isDemoNetwork: isDemo,
            });
            if (!isDemo) {
              void addRecent(newHandle.name, newHandle);
            }
          }
        };

        try {
          const promise = asyncSave();
          await notifyPromiseState(promise, {
            loading: translate("saving"),
            success: translate("saved"),
            error: translate("saveCanceled"),
          });
          return true;
        } catch {
          return false;
        }
      },
      [userTracking, getFsAccess, addRecent, translate, isOurFileOn],
    ),
  );
};
