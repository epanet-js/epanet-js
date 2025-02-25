import { dataAtom, dialogAtom, fileInfoAtom } from "src/state/jotai";
import { ExportOptions } from "src/lib/convert";
import { useAtomCallback } from "jotai/utils";
import { useCallback } from "react";
import { buildInp } from "src/simulation/build-inp";
import toast from "react-hot-toast";
import { translate } from "src/infra/i18n";
import type { fileSave as fileSaveType } from "browser-fs-access";
import { useAtomValue, useSetAtom } from "jotai";

const getDefaultFsAccess = async () => {
  const { fileSave } = await import("browser-fs-access");
  return { fileSave };
};

type FileAccess = {
  fileSave: typeof fileSaveType;
};

export const useSaveInp = ({
  getFsAccess = getDefaultFsAccess,
}: { getFsAccess?: () => Promise<FileAccess> } = {}) => {
  const setDialogState = useSetAtom(dialogAtom);
  const fileInfo = useAtomValue(fileInfoAtom);

  const saveInp = useAtomCallback(
    useCallback(
      async function saveNative(
        get,
        set,
        { isSaveAs = false }: { isSaveAs?: boolean } = {},
      ) {
        const exportOptions: ExportOptions = { type: "inp", folderId: "" };
        const asyncSave = async () => {
          const { fileSave } = await getFsAccess();
          const fileInfo = get(fileInfoAtom);

          const data = get(dataAtom);
          const inp = buildInp(data.hydraulicModel, {
            geolocation: true,
            madeBy: true,
          });
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
              modelVersion: data.hydraulicModel.version,
              handle: newHandle,
              options: exportOptions,
              isMadeByApp: true,
            });
          }
        };

        try {
          const savePromise = asyncSave();
          await toast.promise(
            savePromise,
            {
              loading: translate("saving"),
              success: translate("saved"),
              error: translate("saveCanceled"),
            },
            { style: { minWidth: "120px" }, success: { duration: 2000 } },
          );
          return true;
        } catch (error) {
          return false;
        }
      },
      [getFsAccess],
    ),
  );

  const saveAlerting = useCallback(
    ({ isSaveAs = false }: { isSaveAs?: boolean } = {}) => {
      if (fileInfo && !fileInfo.isMadeByApp) {
        setDialogState({
          type: "alertInpOutput",
          onContinue: () => saveInp({ isSaveAs }),
        });
      } else {
        return saveInp({ isSaveAs });
      }
    },
    [fileInfo, setDialogState, saveInp],
  );

  return saveAlerting;
};
