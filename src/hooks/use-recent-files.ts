import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useAtomValue } from "jotai";
import type { RecentFileEntry } from "src/import/recent-files";
import { recentFilesStoreAtom } from "src/state/file-system";

const QUERY_KEY = ["recent-files"] as const;

function isFileSystemAccessSupported(): boolean {
  return typeof window !== "undefined" && "showOpenFilePicker" in window;
}

export function useRecentFiles() {
  const queryClient = useQueryClient();
  const recentFilesStore = useAtomValue(recentFilesStoreAtom);

  const { data: recentFiles = [] } = useQuery<RecentFileEntry[]>({
    queryKey: QUERY_KEY,
    queryFn: () => recentFilesStore.getAll(),
    enabled: isFileSystemAccessSupported(),
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }, [queryClient]);

  const addRecent = useCallback(
    async (name: string, handle: FileSystemFileHandle) => {
      await recentFilesStore.add(name, handle);
      invalidate();
    },
    [invalidate, recentFilesStore],
  );

  const removeRecent = useCallback(
    async (id: string) => {
      await recentFilesStore.remove(id);
      invalidate();
    },
    [invalidate, recentFilesStore],
  );

  return {
    recentFiles,
    addRecent,
    removeRecent,
    isSupported: isFileSystemAccessSupported(),
  };
}
