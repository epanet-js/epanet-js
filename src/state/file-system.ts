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

export const inpFileInfoAtom = atom<FileInfo | null>(null);

export type ProjectFileInfo = {
  name: string;
  modelVersion: string;
  handle?: FileSystemHandle | FileSystemFileHandle;
};

export const projectFileInfoAtom = atom<ProjectFileInfo | null>(null);

export const currentFileNameAtom = atom<string | null>(
  (get) => get(projectFileInfoAtom)?.name ?? get(inpFileInfoAtom)?.name ?? null,
);

export const isDemoNetworkAtom = atom(
  (get) => get(inpFileInfoAtom)?.isDemoNetwork ?? false,
);

export const recentFilesStoreAtom = atom(
  new RecentFilesStore(defaultRecentFilesDb()),
);
