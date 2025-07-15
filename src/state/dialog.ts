import { FileWithHandle } from "browser-fs-access";
import { atomWithReset } from "jotai/utils";
import { ParserIssues } from "src/import/inp";
import { CustomerPointsParserIssues } from "src/import/customer-points-issues";

export type OpenInpDialogState = {
  type: "openInp";
  file: FileWithHandle;
};

export type InvalidFilesErrorDialogState = {
  type: "invalidFilesError";
};

export type UnsavedChangesDialogState = {
  type: "unsavedChanges";
  onContinue: () => void;
};

export type SimulationSummaryState = {
  type: "simulationSummary";
  status: "success" | "failure" | "warning";
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

export type UpgradeDialogState = {
  type: "upgrade";
};

export type CustomerPointsImportSummaryState = {
  type: "customerPointsImportSummary";
  status: "success" | "warning" | "error";
  count: number;
  issues?: CustomerPointsParserIssues;
};

export type DialogState =
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
  | UpgradeDialogState
  | CustomerPointsImportSummaryState
  | { type: "simulationSettings" }
  | null;

export const dialogFromUrl = (): DialogState => {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);

  const dialog = params.get("dialog");
  if (!dialog) return null;

  return { type: dialog } as DialogState;
};

export const dialogAtom = atomWithReset<DialogState>(null);
