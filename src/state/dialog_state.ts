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

export type InvalidFilesErrorDialogState = {
  type: "invalidFilesError";
};

export type DialogStateExamples = {
  type: "import_example";
};

export type UnsavedChangesDialogState = {
  type: "unsavedChanges";
  onContinue: () => void;
};

export type SimulationSummaryState = {
  type: "simulationSummary";
  status: "success" | "failure";
  duration?: number;
};

export type SimulationReportDialogState = {
  type: "simulationReport";
};

export type WelcomeDialogState = {
  type: "welcome";
};

export type GeocodingNotSupportedDialogState = {
  type: "inpGeocodingNotSupported";
};

export type MissingCoordinatesDialogState = {
  type: "inpMissingCoordinates";
  issues: ParserIssues;
};

export type InpIssuesDialogState = {
  type: "inpIssues";
  issues: ParserIssues;
};

export type AlertInpOutputState = {
  type: "alertInpOutput";
  onContinue: () => void;
};

export type UnlockFullResolution = {
  type: "unlockFullResolution";
};

export type DialogState =
  | DialogStateImport
  | OpenInpDialogState
  | InvalidFilesErrorDialogState
  | {
      type: "cheatsheet";
    }
  | UnsavedChangesDialogState
  | { type: "createNew" }
  | SimulationSummaryState
  | SimulationReportDialogState
  | WelcomeDialogState
  | InpIssuesDialogState
  | { type: "loading" }
  | AlertInpOutputState
  | GeocodingNotSupportedDialogState
  | MissingCoordinatesDialogState
  | UnlockFullResolution
  | null;

export const dialogAtom = atomWithReset<DialogState>(null);
