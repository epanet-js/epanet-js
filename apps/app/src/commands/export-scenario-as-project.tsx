import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { fileSave as fileSaveType } from "browser-fs-access";

import { projectSettingsAtom } from "src/state/project-settings";
import { worktreeAtom } from "src/state/scenarios";
import { notify } from "src/components/notifications";
import { SpinnerIcon, SuccessIcon, WarningIcon } from "src/icons";
import { useUserTracking } from "src/infra/user-tracking";
import { useTranslate } from "src/hooks/use-translate";
import { getBranchStore } from "src/lib/branching";
import { writeQueue } from "src/lib/persistence/write-queue";
import { serializeProjectSettings } from "src/lib/db";
import { captureError, captureWarning } from "src/infra/error-tracking";
import { projectExtension } from "src/commands/save-project";

const exportScenarioToastId = "export-scenario-as-project";

type FileAccess = { fileSave: typeof fileSaveType };

const getDefaultFsAccess = async (): Promise<FileAccess> => {
  const { fileSave } = await import("browser-fs-access");
  return { fileSave };
};

export const useExportScenarioAsProject = ({
  getFsAccess = getDefaultFsAccess,
}: { getFsAccess?: () => Promise<FileAccess> } = {}) => {
  const translate = useTranslate();
  const userTracking = useUserTracking();

  return useAtomCallback(
    useCallback(
      async (get, _set, { source }: { source: string }) => {
        const worktree = get(worktreeAtom);
        if (worktree.activeBranchId === worktree.mainId) return false;
        const scenario = worktree.branches.get(worktree.activeBranchId);
        if (!scenario) return false;

        userTracking.capture({ name: "scenario.exportedAsProject", source });

        const projectSettings = get(projectSettingsAtom);
        const name = `${projectSettings.name} - ${scenario.name}`;

        const exportBlob = async () => {
          await writeQueue.whenIdle();
          const bytes = await getBranchStore().exportBranch(
            scenario.id,
            serializeProjectSettings({ ...projectSettings, name }),
          );
          return new Blob([bytes], { type: "application/octet-stream" });
        };

        notify({
          variant: "default",
          title: "Exporting scenario…",
          Icon: SpinnerIcon,
          id: exportScenarioToastId,
          size: "sm",
          dismissable: false,
          duration: Infinity,
        });
        try {
          const { fileSave } = await getFsAccess();
          await fileSave(exportBlob(), {
            fileName: `${name}${projectExtension}`,
            extensions: [projectExtension],
            description: "EPANET project",
            mimeTypes: ["application/octet-stream"],
          });
          notify({
            variant: "success",
            title: "Scenario exported",
            Icon: SuccessIcon,
            id: exportScenarioToastId,
            size: "sm",
          });
          return true;
        } catch (error) {
          const err = error as Error;
          if (err.name === "AbortError") {
            notify({
              variant: "warning",
              title: translate("saveCanceled"),
              Icon: WarningIcon,
              id: exportScenarioToastId,
              size: "sm",
            });
            return false;
          }
          if (err.name === "NotAllowedError") {
            notify({
              variant: "warning",
              title:
                "Permission to write the file was denied. The scenario was not exported.",
              Icon: WarningIcon,
              id: exportScenarioToastId,
              size: "sm",
            });
            captureWarning("Export scenario: permission denied", err);
            return false;
          }
          captureError(err);
          notify({
            variant: "error",
            size: "md",
            title: "Scenario export failed",
            description: translate("unexpectedErrorContactSupport"),
            Icon: WarningIcon,
            id: exportScenarioToastId,
          });
          return false;
        }
      },
      [getFsAccess, translate, userTracking],
    ),
  );
};
