import { useCallback } from "react";

import { useFileOpen } from "src/hooks/use-file-open";
import { useUnsavedChangesCheck } from "./check-unsaved-changes";
import { useOpenPersistedProject } from "src/hooks/persistence/use-open-persisted-project";
import { useUserTracking } from "src/infra/user-tracking";
import { notify } from "src/components/notifications";
import { SuccessIcon, WarningIcon } from "src/icons";
import { captureError } from "src/infra/error-tracking";
import { useTranslate } from "src/hooks/use-translate";

import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useSetAtom } from "jotai";
import { inpFileInfoAtom, projectFileInfoAtom } from "src/state/file-system";
import { dialogAtom } from "src/state/dialog";
import { projectExtension } from "./save-project";

export const openProjectShortcut = "ctrl+o";

export const useOpenProject = () => {
  const checkUnsavedChanges = useUnsavedChangesCheck();
  const { openFile, isReady } = useFileOpen();
  const { openPersistedProject } = useOpenPersistedProject();
  const setInpFileInfo = useSetAtom(inpFileInfoAtom);
  const setProjectFileInfo = useSetAtom(projectFileInfoAtom);
  const setDialogState = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();
  const translate = useTranslate();
  const isOurFileOn = useFeatureFlag("FLAG_OUR_FILE");

  const openProject = useCallback(
    async ({ source }: { source: string }) => {
      userTracking.capture({ name: "openProject.started", source });

      if (!isOurFileOn) return;
      if (!isReady) throw new Error("FS not ready");

      try {
        const dbFile = await openFile({
          multiple: false,
          extensions: [projectExtension],
          description: "EPANET project",
          mimeTypes: ["application/octet-stream"],
        });
        if (!dbFile) return;

        const result = await openPersistedProject({ file: dbFile });

        if (result.status === "too-new") {
          notify({
            variant: "warning",
            size: "md",
            title: "Project file is too new",
            description:
              "This file was created by a newer version of the app. Please update to open it.",
            Icon: WarningIcon,
          });
          return;
        }

        setProjectFileInfo({
          name: dbFile.name,
          handle: dbFile.handle,
          modelVersion: result.modelVersion,
        });
        setInpFileInfo(null);

        setDialogState(null);
        notify({
          variant: "success",
          title: translate("opened"),
          Icon: SuccessIcon,
          size: "sm",
        });
      } catch (error) {
        captureError(error as Error);
        notify({
          variant: "warning",
          size: "md",
          title: "Project file is invalid",
          Icon: WarningIcon,
        });
      }
    },
    [
      openFile,
      isReady,
      openPersistedProject,
      setInpFileInfo,
      setProjectFileInfo,
      setDialogState,
      translate,
      userTracking,
      isOurFileOn,
    ],
  );

  return useCallback(
    ({ source }: { source: string }) => {
      checkUnsavedChanges(() => openProject({ source }));
    },
    [checkUnsavedChanges, openProject],
  );
};
