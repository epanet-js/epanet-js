import { FileWithHandle } from "browser-fs-access";
import { atomWithReset } from "jotai/utils";
import type { FileGroups } from "src/lib/group_files";

/**
 * Modal state, controlled by dragging and dropping,
 * keybindings, etc.
 */
export type DialogStateImport = {
  type: "import";
  files: FileGroups;
};

export type OpenInpDialogState = {
  type: "openInp";
  file: FileWithHandle;
};

export type DialogStateExamples = {
  type: "import_example";
};

export type UnsavedChangesDialogState = {
  type: "unsavedChanges";
  onContinue: () => void;
};

export type RunSimulationDialogSate = {
  type: "runSimulation";
  status: "running" | "success" | "failure";
  duration?: number;
};

export type SimulationReportDialogState = {
  type: "simulationReport";
};

export type DialogState =
  | DialogStateImport
  | OpenInpDialogState
  | {
      type: "cheatsheet";
    }
  | UnsavedChangesDialogState
  | { type: "createNew" }
  | RunSimulationDialogSate
  | SimulationReportDialogState
  | null;

export const dialogAtom = atomWithReset<DialogState>(null);
