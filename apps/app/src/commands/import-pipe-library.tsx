import { useCallback } from "react";
import { fileOpen } from "browser-fs-access";
import { useUserTracking } from "src/infra/user-tracking";
import {
  parsePipeLibraryFile,
  type ImportPipeLibraryResult,
} from "src/hydraulic-model/pipe-materials";

const openFilePicker = async (): Promise<File | null> => {
  try {
    return await fileOpen({
      extensions: [".csv", ".xlsx"],
      description: "Pipe library file",
      mimeTypes: [
        "text/csv",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ],
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") return null;
    throw error;
  }
};

export const useImportPipeLibrary = () => {
  const { capture } = useUserTracking();

  return useCallback(async (): Promise<ImportPipeLibraryResult | null> => {
    const file = await openFilePicker();
    if (!file) return null;

    const result = await parsePipeLibraryFile(file);
    capture({
      name: "pipeLibrary.importedFromFile",
      status: result.status,
      materialsCount: result.pipeLibrary?.length ?? 0,
      format: result.format,
    });
    return result;
  }, [capture]);
};
