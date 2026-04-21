import { useCallback } from "react";

import { useFileOpen } from "src/hooks/use-file-open";
import { useUnsavedChangesCheck } from "./check-unsaved-changes";
import { useProjectInitialization } from "src/hooks/persistence/use-project-initialization";
import { useUserTracking } from "src/infra/user-tracking";
import { notify } from "src/components/notifications";
import { SuccessIcon, WarningIcon } from "src/icons";
import { captureError } from "src/infra/error-tracking";
import { useTranslate } from "src/hooks/use-translate";

import * as db from "src/db";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { useSetAtom } from "jotai";
import { fileInfoAtom } from "src/state/file-system";
import { dialogAtom } from "src/state/dialog";
import { projectExtension } from "./save-project";

export const openProjectShortcut = "ctrl+o";

export const useOpenProject = () => {
  const checkUnsavedChanges = useUnsavedChangesCheck();
  const { openFile, isReady } = useFileOpen();
  const { initializeProject } = useProjectInitialization();
  const setFileInfo = useSetAtom(fileInfoAtom);
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

        const result = await db.openProject(dbFile);

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

        const { projectSettings, hydraulicModel, factories } =
          await db.fetchProject();

        await initializeProject({
          hydraulicModel,
          factories,
          projectSettings,
          simulationSettings: defaultSimulationSettings,
          autoElevations: projectSettings.projection.type !== "xy-grid",
        });

        setFileInfo({
          name: dbFile.name,
          handle: dbFile.handle,
          modelVersion: hydraulicModel.version,
          isMadeByApp: true,
          isDemoNetwork: false,
          options: { type: "inp", folderId: "" },
        });

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
      initializeProject,
      setFileInfo,
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
