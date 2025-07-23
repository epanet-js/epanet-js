import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import type { FileWithHandle } from "browser-fs-access";

export interface FileOpenOptions {
  multiple?: boolean;
  extensions: string[];
  description: string;
}

const getDefaultFsAccess = async () => {
  return import("browser-fs-access");
};

export const useFileOpen = ({
  getFsAccess = getDefaultFsAccess,
}: {
  getFsAccess?: () => Promise<typeof import("browser-fs-access")>;
} = {}) => {
  const { data: fsAccess } = useQuery({
    queryKey: ["browser-fs-access"],
    queryFn: getFsAccess,
  });

  const openFile = useCallback(
    async (options: FileOpenOptions): Promise<FileWithHandle | null> => {
      if (!fsAccess) throw new Error("FS not ready");

      try {
        const result = await fsAccess.fileOpen({
          multiple: options.multiple || false,
          extensions: options.extensions,
          description: options.description,
        });

        if (Array.isArray(result)) {
          return result[0] || null;
        }
        return result;
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return null;
        }
        throw error;
      }
    },
    [fsAccess],
  );

  return {
    openFile,
    isReady: !!fsAccess,
  };
};
