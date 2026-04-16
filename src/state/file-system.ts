import { atom } from "jotai";
import type { FileSystemHandle } from "browser-fs-access";
import type { ExportOptions } from "src/types/export";
import { defaultRecentFilesDb, RecentFilesStore } from "src/lib/recent-files";

export type FileInfo = {
  name: string;
  modelVersion: string;
  handle?: FileSystemHandle | FileSystemFileHandle;
  isMadeByApp: boolean;
  isDemoNetwork: boolean;
  options: ExportOptions;
};

export const fileInfoAtom = atom<FileInfo | null>(null);

export const isDemoNetworkAtom = atom(
  (get) => get(fileInfoAtom)?.isDemoNetwork ?? false,
);

export const recentFilesStoreAtom = atom(
  new RecentFilesStore(defaultRecentFilesDb()),
);
