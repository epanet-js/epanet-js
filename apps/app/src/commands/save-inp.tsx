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
import { buildInp } from "src/simulation/build-inp";
import { useTranslate } from "src/hooks/use-translate";
import type { fileSave as fileSaveType } from "browser-fs-access";
import { useAtomValue, useSetAtom } from "jotai";
import { notify } from "src/components/notifications";
import { SpinnerIcon, SuccessIcon, WarningIcon } from "src/icons";
import { useUserTracking } from "src/infra/user-tracking";
import { worktreeAtom } from "src/state/scenarios";
import { useRecentFiles } from "src/hooks/use-recent-files";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
const getDefaultFsAccess = async () => {
  const { fileSave } = await import("browser-fs-access");
  return { fileSave };
};

type FileAccess = {
  fileSave: typeof fileSaveType;
};

export const saveShortcut = "ctrl+s";
export const saveAsShortcut = "ctrl+shift+s";

const exportInpToastId = "export-inp";

export const useSaveInp = ({
  getFsAccess = getDefaultFsAccess,
}: { getFsAccess?: () => Promise<FileAccess> } = {}) => {
  const translate = useTranslate();
  const setDialogState = useSetAtom(dialogAtom);
  const fileInfo = useAtomValue(inpFileInfoAtom);
  const { addRecent } = useRecentFiles();
  const userTracking = useUserTracking();
  const map = useContext(MapContext);
  const isOurFileOn = useFeatureFlag("FLAG_OUR_FILE");

  const saveInp = useAtomCallback(
    useCallback(
      async function saveNative(
        get,
        set,
        { source, isSaveAs = false }: { source: string; isSaveAs?: boolean },
      ) {
        userTracking.capture({
          name: isOurFileOn ? "inp.exported" : "model.saved",
          source,
          isSaveAs,
        });
        const exportOptions: ExportOptions = { type: "inp", folderId: "" };
        const asyncSave = async () => {
          const { fileSave } = await getFsAccess();
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
            customerDemands: true,
            customerPoints: true,
            inactiveAssets: true,
            reservoirElevations: true,
            includeQuality: true,
            projection: projectSettings.projection,
            simulationSettings,
            units: projectSettings.units,
            headlossFormula: projectSettings.headlossFormula,
          };
          const inp = buildInp(hydraulicModel, buildOptions);
          const inpBlob = new Blob([inp], { type: "text/plain" });

          const suggestedName = fileInfo
            ? fileInfo.name
            : projectInfo
              ? `${projectInfo.name.replace(/\.[^.]+$/, "")}.inp`
              : "my-network.inp";

          const newHandle = await fileSave(
            inpBlob,
            {
              fileName: suggestedName,
              extensions: [".inp"],
              description: ".INP",
              mimeTypes: ["text/plain"],
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
              options: exportOptions,
              isMadeByApp: true,
              isDemoNetwork: isDemo,
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
        } catch {
          notify({
            variant: "warning",
            title: translate("exportInpCanceled"),
            Icon: WarningIcon,
            id: exportInpToastId,
            size: "sm",
          });
          return false;
        }
      },
      [userTracking, getFsAccess, addRecent, translate, map, isOurFileOn],
    ),
  );

  const worktree = useAtomValue(worktreeAtom);
  const hasScenarios = worktree.scenarios.length > 0;

  const saveAlerting = useCallback(
    ({ source, isSaveAs = false }: { source: string; isSaveAs?: boolean }) => {
      const proceedWithSave = () => {
        if (!isOurFileOn && fileInfo && !fileInfo.isMadeByApp) {
          setDialogState({
            type: "alertInpOutput",
            onContinue: () => saveInp({ source, isSaveAs }),
          });
        } else {
          return saveInp({ source, isSaveAs });
        }
      };

      if (hasScenarios) {
        setDialogState({
          type: "alertScenariosNotSaved",
          onContinue: proceedWithSave,
        });
      } else {
        return proceedWithSave();
      }
    },
    [fileInfo, setDialogState, saveInp, hasScenarios, isOurFileOn],
  );

  return saveAlerting;
};
