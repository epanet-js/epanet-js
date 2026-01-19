import { dataAtom, dialogAtom, fileInfoAtom } from "src/state/jotai";
import { ExportOptions } from "src/types/export";
import { useAtomCallback } from "jotai/utils";
import { useCallback } from "react";
import { buildInp } from "src/simulation/build-inp";
import { useTranslate } from "src/hooks/use-translate";
import type { fileSave as fileSaveType } from "browser-fs-access";
import { useAtomValue, useSetAtom } from "jotai";
import { notifyPromiseState } from "src/components/notifications";
import { useUserTracking } from "src/infra/user-tracking";
import { useLegitFs } from "src/components/legit-fs-provider";
import { captureError } from "src/infra/error-tracking";

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
  const legitFs = useLegitFs();

  const saveInp = useAtomCallback(
    useCallback(
      async function saveNative(
        get,
        set,
        {
          source,
          isSaveAs = false,
          exportInp = false,
        }: { source: string; isSaveAs?: boolean; exportInp?: boolean },
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

          const data = get(dataAtom);
          const buildOptions = {
            geolocation: true,
            madeBy: true,
            labelIds: true,
            customerDemands: true,
            customerPoints: true,
            inactiveAssets: true,
          };
          const inp = buildInp(data.hydraulicModel, buildOptions);
          const inpBlob = new Blob([inp], { type: "text/plain" });

          // Interim fix for .epanet files
          // TODO: Remove this once we have a proper way to handle .epanet files
          // assumption inp and epanet file are named the same
          const inpFileName = fileInfo
            ? fileInfo.name.replace(/\.epanet$/, ".inp")
            : "my-network.inp";

          // save to versioned memory file system
          if (legitFs) {
            try {
              await legitFs.promises.writeFile(inpFileName, inp);
            } catch (error) {
              captureError(error as Error);
            }
          }

          // check if there are multiple branches -> indicate the need of a epanet archive
          let isMultipleBranches = false;
          if (legitFs) {
            try {
              let branches = await legitFs.promises.readdir("/.legit/branches");
              branches = branches.filter(
                (branch) => branch !== "anonymous" && branch !== "main",
              );

              isMultipleBranches = branches.length > 0;
            } catch (error) {
              captureError(error as Error);
            }
          }

          // save to local file system
          if (isMultipleBranches && legitFs && !exportInp) {
            // If multiple branches exist, use archive function instead of normal save
            try {
              const archive = await legitFs.saveArchive();
              let archiveBlob: Blob;
              if (archive instanceof Blob) {
                archiveBlob = archive;
              } else if (archive instanceof ArrayBuffer) {
                archiveBlob = new Blob([archive], { type: "application/zip" });
              } else if (archive instanceof Uint8Array) {
                const uint8Copy = new Uint8Array(archive);
                archiveBlob = new Blob([uint8Copy], {
                  type: "application/zip",
                });
              } else {
                archiveBlob = new Blob([archive as unknown as BlobPart], {
                  type: "application/zip",
                });
              }

              const fileName = fileInfo
                ? fileInfo.name.replace(/\.inp$/, ".epanet")
                : "my-network.epanet";

              const newHandle = await fileSave(
                archiveBlob,
                {
                  fileName,
                  extensions: [".epanet"],
                  description: ".EPANET",
                  mimeTypes: ["application/zip"],
                },
                fileInfo && !isSaveAs
                  ? (fileInfo.handle as FileSystemFileHandle)
                  : null,
              );

              if (newHandle) {
                set(fileInfoAtom, {
                  name: newHandle.name.endsWith(".epanet")
                    ? newHandle.name
                    : newHandle.name.replace(/\.inp$/, ".epanet"),
                  modelVersion: data.hydraulicModel.version,
                  handle: newHandle,
                  options: exportOptions,
                  isMadeByApp: true,
                });
              }
            } catch (error) {
              captureError(error as Error);
            }
          } else {
            // save inp file
            const newHandle = await fileSave(
              inpBlob,
              {
                fileName: fileInfo
                  ? fileInfo.name.replace(/\.epanet$/, ".inp")
                  : "my-network.inp",
                extensions: [".inp"],
                description: ".INP",
                mimeTypes: ["text/plain"],
              },
              fileInfo && !isSaveAs
                ? (fileInfo.handle as FileSystemFileHandle)
                : null,
            );
            if (newHandle && !exportInp) {
              set(fileInfoAtom, {
                name: newHandle.name,
                modelVersion: data.hydraulicModel.version,
                handle: newHandle,
                options: exportOptions,
                isMadeByApp: true,
              });
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
      [getFsAccess, userTracking, translate, legitFs],
    ),
  );

  const saveAlerting = useCallback(
    ({
      source,
      isSaveAs = false,
      exportInp = false,
    }: {
      source: string;
      isSaveAs?: boolean;
      exportInp?: boolean;
    }) => {
      if (fileInfo && !fileInfo.isMadeByApp) {
        setDialogState({
          type: "alertInpOutput",
          onContinue: () => saveInp({ source, isSaveAs, exportInp }),
        });
      } else {
        return saveInp({ source, isSaveAs, exportInp });
      }
    },
    [fileInfo, setDialogState, saveInp],
  );

  return saveAlerting;
};
