import { dialogAtom, fileInfoAtom, stagingModelAtom } from "src/state/jotai";
import { ExportOptions } from "src/types/export";
import { useAtomCallback } from "jotai/utils";
import { useCallback } from "react";
import { buildInp } from "src/simulation/build-inp";
import { useTranslate } from "src/hooks/use-translate";
import type { fileSave as fileSaveType } from "browser-fs-access";
import { useAtomValue, useSetAtom } from "jotai";
import { notifyPromiseState } from "src/components/notifications";
import { useUserTracking } from "src/infra/user-tracking";

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
  const userTracking = useUserTracking();

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

          const hydraulicModel = get(stagingModelAtom);
          const buildOptions = {
            geolocation: true,
            madeBy: true,
            labelIds: true,
            customerDemands: true,
            customerPoints: true,
            inactiveAssets: true,
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
            set(fileInfoAtom, {
              name: newHandle.name,
              modelVersion: hydraulicModel.version,
              handle: newHandle,
              options: exportOptions,
              isMadeByApp: true,
            });
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
      [getFsAccess, userTracking, translate],
    ),
  );

  const saveAlerting = useCallback(
    ({ source, isSaveAs = false }: { source: string; isSaveAs?: boolean }) => {
      if (fileInfo && !fileInfo.isMadeByApp) {
        setDialogState({
          type: "alertInpOutput",
          onContinue: () => saveInp({ source, isSaveAs }),
        });
      } else {
        return saveInp({ source, isSaveAs });
      }
    },
    [fileInfo, setDialogState, saveInp],
  );

  return saveAlerting;
};
