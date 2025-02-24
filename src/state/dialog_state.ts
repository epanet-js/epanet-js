import { FileWithHandle } from "browser-fs-access";
import { atomWithReset } from "jotai/utils";
import { ParserIssues } from "src/import/inp";
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

export type WelcomeDialogState = {
  type: "welcome";
};

export type InpIssuesDialogState = {
  type: "inpIssues";
  issues: ParserIssues;
};

export type AlertInpOutputState = {
  type: "alertInpOutput";
  onContinue: () => void;
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
  | WelcomeDialogState
  | InpIssuesDialogState
  | { type: "loading" }
  | AlertInpOutputState
  | null;

export const dialogAtom = atomWithReset<DialogState>(null);
