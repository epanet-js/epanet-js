import { atom } from "jotai";
import type { FileSystemHandle } from "browser-fs-access";
import type { ExportOptions } from "src/types/export";
import { atomWithMachine } from "jotai-xstate";
import { createMachine } from "xstate";

export type FileInfo = {
  name: string;
  modelVersion: string;
  handle?: FileSystemHandle | FileSystemFileHandle;
  isMadeByApp: boolean;
  isDemoNetwork: boolean;
  options: ExportOptions;
};

export const fileInfoAtom = atom<FileInfo | null>(null);

const fileInfoMachine = createMachine({
  predictableActionArguments: true,
  id: "fileInfo",
  initial: "idle",
  states: {
    idle: {
      on: {
        show: "visible",
      },
    },
    visible: {
      after: {
        2000: {
          target: "idle",
        },
      },
    },
  },
});

export const fileInfoMachineAtom = atomWithMachine(() => fileInfoMachine);

export const isDemoNetworkAtom = atom(
  (get) => get(fileInfoAtom)?.isDemoNetwork ?? false,
);
