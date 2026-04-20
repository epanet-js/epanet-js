import { useCallback } from "react";

import { useFileOpen } from "src/hooks/use-file-open";
import { useUnsavedChangesCheck } from "./check-unsaved-changes";
import { useProjectInitialization } from "src/hooks/persistence/use-project-initialization";
import { useUserTracking } from "src/infra/user-tracking";
import { notify } from "src/components/notifications";
import { SuccessIcon, WarningIcon } from "src/icons";
import { captureError } from "src/infra/error-tracking";
import { useTranslate } from "src/hooks/use-translate";

import { getDbWorker } from "src/db";
import { projectSettingsSchema } from "src/lib/project-settings/project-settings-schema";
import { initializeHydraulicModel } from "src/hydraulic-model";
import { initializeModelFactories } from "src/hydraulic-model/factories";
import { LabelManager } from "src/hydraulic-model/label-manager";
import { ConsecutiveIdsGenerator } from "src/lib/id-generator";
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

  const openProject = useCallback(
    async ({ source }: { source: string }) => {
      userTracking.capture({ name: "openProject.started", source });

      if (!isReady) throw new Error("FS not ready");

      try {
        const file = await openFile({
          multiple: false,
          extensions: [projectExtension],
          description: "EPANET project",
          mimeTypes: ["application/octet-stream"],
        });
        if (!file) return;

        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        const worker = getDbWorker();
        const result = await worker.openDb(bytes);

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

        const settingsJson = await worker.getProjectSettings();
        if (!settingsJson) {
          notify({
            variant: "warning",
            size: "md",
            title: "Project file is invalid",
            Icon: WarningIcon,
          });
          return;
        }

        const projectSettings = projectSettingsSchema.parse(
          JSON.parse(settingsJson),
        );

        const idGenerator = new ConsecutiveIdsGenerator();
        const hydraulicModel = initializeHydraulicModel({ idGenerator });
        const factories = initializeModelFactories({
          idGenerator,
          labelManager: new LabelManager(),
          defaults: projectSettings.defaults,
        });

        await initializeProject({
          hydraulicModel,
          factories,
          projectSettings,
          simulationSettings: defaultSimulationSettings,
          autoElevations: projectSettings.projection.type !== "xy-grid",
        });

        setFileInfo({
          name: file.name,
          handle: file.handle,
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
    ],
  );

  return useCallback(
    ({ source }: { source: string }) => {
      checkUnsavedChanges(() => openProject({ source }));
    },
    [checkUnsavedChanges, openProject],
  );
};
