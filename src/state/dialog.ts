import { atomWithReset } from "jotai/utils";
import { ParserIssues } from "src/import/inp";
import { CurveId } from "src/hydraulic-model/curves";
import type { FeatureCollection } from "geojson";
import type { Projection } from "src/lib/projections";

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
  onContinue?: () => void;
  onIgnore?: () => void;
  ignoreLabel?: string;
};

export type SimulationReportDialogState = {
  type: "simulationReport";
};

export type WelcomeDialogState = {
  type: "welcome";
};

export type NetworkProjectionDialogState = {
  type: "networkProjection";
  previewGeoJson: FeatureCollection;
  onImportWithProjection: (projection: Projection) => void;
  filename: string;
  flowUnits: string;
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

export type ImportCustomerPointsWizardState = {
  type: "importCustomerPointsWizard";
};

export type ImportCustomerPointsWarningDialogState = {
  type: "importCustomerPointsWarning";
  onContinue: () => void;
};

export type UnexpectedErrorDialogState = {
  type: "unexpectedError";
  onRetry?: () => void;
};

export type ModelBuilderIframeDialogState = {
  type: "modelBuilderIframe";
};

export type EarlyAccessDialogState = {
  type: "earlyAccess";
  onContinue: () => void;
  afterSignupDialog?: string;
};

export type SimulationProgressDialogState = {
  type: "simulationProgress";
  currentTime: number;
  totalDuration: number;
};

export type PatternsLibraryDialog = {
  type: "patternsLibrary";
  initialPatternId?: number;
  initialSection?:
    | "demand"
    | "reservoirHead"
    | "pumpSpeed"
    | "qualitySourceStrength"
    | "energyPrice";
};

export type PumpLibraryDialogState = {
  type: "pumpLibrary";
  initialCurveId?: CurveId;
  initialSection?: "pump" | "efficiency";
};

export type CurveLibraryDialogState = {
  type: "curveLibrary";
  initialCurveId?: CurveId;
  initialSection?: "volume" | "valve" | "headloss";
};

export type DeleteScenarioConfirmationDialogState = {
  type: "deleteScenarioConfirmation";
  scenarioId: string;
  scenarioName: string;
  onConfirm: (scenarioId: string) => void;
};

export type RenameScenarioDialogState = {
  type: "renameScenario";
  scenarioId: string;
  currentName: string;
  onConfirm: (scenarioId: string, newName: string) => void;
};

export type ScenariosPaywallDialogState = {
  type: "scenariosPaywall";
};

export type FirstScenarioDialogState = {
  type: "firstScenario";
  onConfirm: () => void;
};

export type AlertScenariosNotSavedState = {
  type: "alertScenariosNotSaved";
  onContinue: () => void;
};

export type AlertNetworkRequiredState = {
  type: "alertNetworkRequired";
};

export type ActivatingTrialDialogState = {
  type: "activatingTrial";
};

export type DialogState =
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
  | MissingCoordinatesDialogState
  | UpgradeDialogState
  | ImportCustomerPointsWizardState
  | ImportCustomerPointsWarningDialogState
  | UnexpectedErrorDialogState
  | ModelBuilderIframeDialogState
  | EarlyAccessDialogState
  | SimulationProgressDialogState
  | { type: "simulationSettings" }
  | { type: "controls" }
  | PatternsLibraryDialog
  | PumpLibraryDialogState
  | CurveLibraryDialogState
  | DeleteScenarioConfirmationDialogState
  | RenameScenarioDialogState
  | ScenariosPaywallDialogState
  | FirstScenarioDialogState
  | AlertScenariosNotSavedState
  | AlertNetworkRequiredState
  | ActivatingTrialDialogState
  | NetworkProjectionDialogState
  | null;

export const dialogFromUrl = (): DialogState => {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);

  const dialog = params.get("dialog");
  if (!dialog) return null;

  return { type: dialog } as DialogState;
};

export const dialogAtom = atomWithReset<DialogState>(null);
