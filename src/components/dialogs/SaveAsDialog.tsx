import { ExportOptions } from "src/lib/convert";
import { captureError } from "src/infra/error-tracking";
import toast from "react-hot-toast";
import { dataAtom, fileInfoAtom } from "src/state/jotai";
import { useAtomValue, useSetAtom } from "jotai";
import { buildInp } from "src/simulation/build-inp";
import { useCallback, useEffect } from "react";
import { Loading } from "../elements";

export function SaveAsDialog({ onClose }: { onClose: () => void }) {
  const data = useAtomValue(dataAtom);

  const setFileInfo = useSetAtom(fileInfoAtom);

  const saveAs = useCallback(async () => {
    const exportOptions: ExportOptions = {
      type: "inp",
      folderId: "",
    };
    const inp = buildInp(data.hydraulicModel, { geolocation: true });
    const { fileSave } = await import("browser-fs-access");

    try {
      const newHandle = await fileSave(
        new Blob([inp], { type: "text/plain" }),
        {
          fileName: "my-network.inp",
          extensions: [".inp"],
          description: "Save file",
          mimeTypes: ["text/plain"],
        },
        null,
      );
      if (newHandle) {
        setFileInfo({ handle: newHandle, options: exportOptions });
      }
      toast.success("Saved");
      onClose();
    } catch (e) {
      captureError(e as Error);
    }
  }, [setFileInfo, onClose, data.hydraulicModel]);

  useEffect(() => {
    saveAs();
  }, [saveAs]);

  return <Loading />;
}
