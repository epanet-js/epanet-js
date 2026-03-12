import { dataAtom } from "src/state/data";
import { dialogAtom } from "src/state/dialog";
import { fileInfoAtom } from "src/state/file-system";
import { stagingModelAtom } from "src/state/hydraulic-model";
import { isDemoNetworkAtom } from "src/state/file-system";
import { simulationSettingsAtom } from "src/state/simulation-settings";
import { baseModelAtom } from "src/state/hydraulic-model";
import { ExportOptions } from "src/types/export";
import { useAtomCallback } from "jotai/utils";
import { useCallback, useContext } from "react";
import { MapContext, captureThumbnail } from "src/map";
import { buildInp } from "src/simulation/build-inp";
import { useTranslate } from "src/hooks/use-translate";
import type { fileSave as fileSaveType } from "browser-fs-access";
import { useAtomValue, useSetAtom } from "jotai";
import { notifyPromiseState } from "src/components/notifications";
import { useUserTracking } from "src/infra/user-tracking";
import { worktreeAtom } from "src/state/scenarios";
import { useRecentFiles } from "src/hooks/use-recent-files";
const getDefaultFsAccess = async () => {
  const { fileSave } = await import("browser-fs-access");
  return { fileSave };
};

type FileAccess = {
  fileSave: typeof fileSaveType;
};

export const saveShortcut = "ctrl+s";
export const saveAsShortcut = "ctrl+shift+s";

export const useSaveInp = ({
  getFsAccess = getDefaultFsAccess,
}: { getFsAccess?: () => Promise<FileAccess> } = {}) => {
  const translate = useTranslate();
  const setDialogState = useSetAtom(dialogAtom);
  const fileInfo = useAtomValue(fileInfoAtom);
  const { addRecent } = useRecentFiles();
  const userTracking = useUserTracking();
  const map = useContext(MapContext);

  const saveInp = useAtomCallback(
    useCallback(
      async function saveNative(
        get,
        set,
        { source, isSaveAs = false }: { source: string; isSaveAs?: boolean },
      ) {
        userTracking.capture({
          name: "model.saved",
          source,
          isSaveAs,
        });
        const exportOptions: ExportOptions = { type: "inp", folderId: "" };
        const asyncSave = async () => {
          const { fileSave } = await getFsAccess();
          const fileInfo = get(fileInfoAtom);

          const worktree = get(worktreeAtom);
          const hasScenarios = worktree.scenarios.length > 0;
          const hydraulicModel = hasScenarios
            ? get(baseModelAtom)
            : get(stagingModelAtom);
          const { modelMetadata } = get(dataAtom);
          const simulationSettings = get(simulationSettingsAtom);
          const buildOptions = {
            geolocation: true,
            madeBy: true,
            labelIds: true,
            customerDemands: true,
            customerPoints: true,
            inactiveAssets: true,
            reservoirElevations: true,
            projectionMapper: modelMetadata.projectionMapper,
            simulationSettings,
            units: modelMetadata.quantities.units,
          };
          const inp = buildInp(hydraulicModel, buildOptions);
          const inpBlob = new Blob([inp], { type: "text/plain" });

          const newHandle = await fileSave(
            inpBlob,
            {
              fileName: fileInfo ? fileInfo.name : "my-network.inp",
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
            set(fileInfoAtom, {
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

        try {
          const savePromise = asyncSave();
          await notifyPromiseState(savePromise, {
            loading: translate("saving"),
            success: translate("saved"),
            error: translate("saveCanceled"),
          });
          return true;
        } catch (error) {
          return false;
        }
      },
      [userTracking, getFsAccess, addRecent, translate, map],
    ),
  );

  const worktree = useAtomValue(worktreeAtom);
  const hasScenarios = worktree.scenarios.length > 0;

  const saveAlerting = useCallback(
    ({ source, isSaveAs = false }: { source: string; isSaveAs?: boolean }) => {
      const proceedWithSave = () => {
        if (fileInfo && !fileInfo.isMadeByApp) {
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
    [fileInfo, setDialogState, saveInp, hasScenarios],
  );

  return saveAlerting;
};
