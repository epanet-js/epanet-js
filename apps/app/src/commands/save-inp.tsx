import { dialogAtom } from "src/state/dialog";
import { projectSettingsAtom } from "src/state/project-settings";
import { inpFileInfoAtom, projectFileInfoAtom } from "src/state/file-system";
import {
  stagingModelDerivedAtom,
  baseModelDerivedAtom,
  simulationSettingsDerivedAtom,
} from "src/state/derived-branch-state";
import { isDemoNetworkAtom } from "src/state/file-system";
import { ExportOptions } from "src/types/export";
import { useAtomCallback } from "jotai/utils";
import { useCallback, useContext } from "react";
import { MapContext, captureThumbnail } from "src/map";
import { buildInpToFile } from "src/simulation/build-inp";
import { FileSystemHelpers } from "src/lib/export/file-system-helpers";
import { useTranslate } from "src/hooks/use-translate";
import { useAtomValue, useSetAtom } from "jotai";
import { notify } from "src/components/notifications";
import { handleError } from "src/infra/errors";
import { SpinnerIcon, SuccessIcon, WarningIcon, ErrorIcon } from "src/icons";
import { useUserTracking } from "src/infra/user-tracking";
import { worktreeAtom } from "src/state/scenarios";
import { useRecentFiles } from "src/hooks/use-recent-files";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export const saveShortcut = "ctrl+s";
export const saveAsShortcut = "ctrl+shift+s";

const exportInpToastId = "export-inp";

export const useSaveInp = () => {
  const translate = useTranslate();
  const setDialogState = useSetAtom(dialogAtom);
  const { addRecent } = useRecentFiles();
  const userTracking = useUserTracking();
  const map = useContext(MapContext);
  const isExportLabelsOn = useFeatureFlag("FLAG_EXPORT_LABELS");

  const saveInp = useAtomCallback(
    useCallback(
      async function saveNative(
        get,
        set,
        { source, isSaveAs = false }: { source: string; isSaveAs?: boolean },
      ) {
        userTracking.capture({
          name: "inp.exported",
          source,
          isSaveAs,
        });
        const exportOptions: ExportOptions = { type: "inp" };
        const asyncSave = async () => {
          const fileInfo = get(inpFileInfoAtom);
          const projectInfo = get(projectFileInfoAtom);

          const worktree = get(worktreeAtom);
          const hasScenarios = worktree.scenarios.length > 0;
          const hydraulicModel = hasScenarios
            ? get(baseModelDerivedAtom)
            : get(stagingModelDerivedAtom);
          const projectSettings = get(projectSettingsAtom);
          const simulationSettings = get(simulationSettingsDerivedAtom);
          const buildOptions = {
            geolocation: true,
            madeBy: true,
            labelIds: true,
            enforceLabelLimit: isExportLabelsOn,
            customerDemands: true,
            includeQuality: true,
            projection: projectSettings.projection,
            simulationSettings,
            units: projectSettings.units,
            headlossFormula: projectSettings.headlossFormula,
          };

          const suggestedName = fileInfo
            ? fileInfo.name
            : projectInfo
              ? `${projectInfo.name.replace(/\.[^.]+$/, "")}.inp`
              : "my-network.inp";

          const isNativeFsSupported =
            FileSystemHelpers.isFileSystemAccessSupported();
          const previousHandle =
            fileInfo && !isSaveAs
              ? (fileInfo.handle as FileSystemFileHandle)
              : null;

          const handle = isNativeFsSupported
            ? (previousHandle ??
              (await FileSystemHelpers.openFileInFileSystem(
                suggestedName,
                ".INP",
                "text/plain",
                ".inp",
              )))
            : await FileSystemHelpers.openFileInOpfs(suggestedName);

          const writable = await handle.createWritable();
          try {
            await buildInpToFile(writable, hydraulicModel, buildOptions);
            await writable.close();
          } catch (error) {
            await writable.abort();
            throw error;
          }

          if (!isNativeFsSupported) {
            await FileSystemHelpers.triggerDownload(suggestedName, handle);
            return;
          }

          const isDemo = get(isDemoNetworkAtom);
          set(inpFileInfoAtom, {
            name: handle.name,
            modelVersion: hydraulicModel.version,
            handle,
            options: exportOptions,
            isMadeByApp: true,
            isDemoNetwork: isDemo,
          });
          if (!isDemo) {
            const thumbnail = map
              ? (captureThumbnail(map) ?? undefined)
              : undefined;
            void addRecent(handle.name, handle, thumbnail);
          }
        };

        notify({
          variant: "default",
          title: translate("generatingInp"),
          Icon: SpinnerIcon,
          id: exportInpToastId,
          size: "sm",
          dismissable: false,
          duration: Infinity,
        });
        try {
          await asyncSave();
          notify({
            variant: "success",
            title: translate("exportedAsInp"),
            Icon: SuccessIcon,
            id: exportInpToastId,
            size: "sm",
          });
          return true;
        } catch (error) {
          handleError(error, {
            as: "INP export failed",
            ignore: ["AbortError"],
            onUnexpected: "capture",
          });

          if (error instanceof RangeError) {
            notify({
              variant: "error",
              title: translate("exportInpTooLarge"),
              Icon: ErrorIcon,
              id: exportInpToastId,
              size: "sm",
              duration: Infinity,
            });
            return false;
          }
          notify({
            variant: "warning",
            title: translate("exportInpCanceled"),
            Icon: WarningIcon,
            id: exportInpToastId,
            duration: Infinity,
            size: "sm",
          });
          return false;
        }
      },
      [userTracking, addRecent, translate, map, isExportLabelsOn],
    ),
  );

  const worktree = useAtomValue(worktreeAtom);
  const hasScenarios = worktree.scenarios.length > 0;

  const saveAlerting = useCallback(
    ({ source, isSaveAs = false }: { source: string; isSaveAs?: boolean }) => {
      const proceedWithSave = () => saveInp({ source, isSaveAs });

      if (hasScenarios) {
        setDialogState({
          type: "alertScenariosNotSaved",
          onContinue: proceedWithSave,
        });
      } else {
        return proceedWithSave();
      }
    },
    [setDialogState, saveInp, hasScenarios],
  );

  return saveAlerting;
};
