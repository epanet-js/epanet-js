import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import type { FileWithHandle } from "browser-fs-access";
import { useTogglePlayback } from "src/commands/toggle-playback";
import { handleError } from "src/infra/errors";

export interface FileOpenOptions {
  multiple?: boolean;
  extensions: string[];
  description: string;
  mimeTypes?: string[];
}

const getDefaultFsAccess = async () => {
  return import("browser-fs-access");
};

let isPickerOpen = false;

export const useFileOpen = ({
  getFsAccess = getDefaultFsAccess,
}: {
  getFsAccess?: () => Promise<typeof import("browser-fs-access")>;
} = {}) => {
  const { data: fsAccess } = useQuery({
    queryKey: ["browser-fs-access"],
    queryFn: getFsAccess,
  });
  const { stopPlayback } = useTogglePlayback();

  const openFile = useCallback(
    async (options: FileOpenOptions): Promise<FileWithHandle | null> => {
      if (!fsAccess) throw new Error("FS not ready");
      if (isPickerOpen) return null;

      stopPlayback("auto");
      isPickerOpen = true;
      try {
        const result = await fsAccess.fileOpen({
          multiple: options.multiple || false,
          extensions: options.extensions,
          description: options.description,
          mimeTypes: options.mimeTypes,
        });

        if (Array.isArray(result)) {
          return result[0] || null;
        }
        return result;
      } catch (error) {
        handleError(error, {
          as: "openFile: file picker failed",
          ignore: ["AbortError"],
          warn: ["NotAllowedError"],
        });
        return null;
      } finally {
        isPickerOpen = false;
      }
    },
    [fsAccess, stopPlayback],
  );

  return {
    openFile,
    isReady: !!fsAccess,
  };
};
