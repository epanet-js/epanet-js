import { dataAtom, fileInfoAtom, fileInfoMachineAtom } from "src/state/jotai";
import { ExportOptions, fromGeoJSON } from "src/lib/convert";
import { EitherAsync } from "purify-ts/EitherAsync";
import type { ConvertError } from "src/lib/errors";
import { useAtomCallback } from "jotai/utils";
import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { buildInp } from "src/simulation/build-inp";
import toast from "react-hot-toast";
import { translate } from "src/infra/i18n";

export const useSaveInp = () => {
  return useAtomCallback(
    useCallback(function saveNative(get, set) {
      const exportOptions: ExportOptions = { type: "inp", folderId: "" };
      const asyncSave = async () => {
        const { fileSave } = await import("browser-fs-access");
        const fileInfo = get(fileInfoAtom);
        const data = get(dataAtom);
        const inp = buildInp(data.hydraulicModel, { geolocation: true });
        const inpBlob = new Blob([inp], { type: "text/plain" });

        const newHandle = await fileSave(
          inpBlob,
          {
            fileName: fileInfo ? fileInfo.name : "my-network.inp",
            extensions: [".inp"],
            description: ".INP",
            mimeTypes: ["text/plain"],
          },
          fileInfo ? (fileInfo.handle as FileSystemFileHandle) : null,
        );
        if (newHandle) {
          set(fileInfoAtom, {
            name: newHandle.name,
            handle: newHandle,
            options: exportOptions,
          });
        }
      };

      toast.promise(
        asyncSave(),
        {
          loading: translate("saving"),
          success: translate("saved"),
          error: translate("saveCanceled"),
        },
        { style: { minWidth: "120px" }, success: { duration: 2000 } },
      );
    }, []),
  );
};
export function useFileSaveDeprecated() {
  const send = useSetAtom(fileInfoMachineAtom);
  return useAtomCallback(
    useCallback(
      function saveNative(get, set) {
        return EitherAsync<ConvertError, boolean>(
          async function functionSaveNativeInner({ fromPromise }) {
            const { supported, fileSave } = await import("browser-fs-access");
            const fileInfo = get(fileInfoAtom);
            const data = get(dataAtom);
            if (!(fileInfo && supported)) return false;
            return fromPromise(
              fromGeoJSON(data, fileInfo.options).map(async (res) => {
                const newHandle = await fileSave(
                  res.result.blob,
                  {
                    fileName: "map.svg",
                    description: "Save file",
                  },
                  fileInfo.handle as unknown as FileSystemFileHandle,
                  true,
                );
                send("show");
                if (newHandle) {
                  set(fileInfoAtom, {
                    name: newHandle.name,
                    handle: newHandle,
                    options: fileInfo.options,
                  });
                }
                return true;
              }),
            );
          },
        );
      },
      [send],
    ),
  );
}
