import { atomWithReset } from "jotai/utils";
import { ParserIssues } from "src/import/inp";
import type { QualitySimulationType } from "src/simulation/simulation-settings";
import { CurveId } from "src/hydraulic-model/curves";
import type { BBox, FeatureCollection } from "geojson";
import type { Proj4Projection, Projection } from "src/lib/projections";

export type InvalidFilesErrorDialogState = {
  type: "invalidFilesError";
};

export type UnsavedChangesDialogState = {
  type: "unsavedChanges";
  onContinue: () => void;
};

export type SimulationSummaryState = {
  type: "simulationSummary";
  status: "success" | "failure" | "warning" | "stopped";
  duration?: number;
  qualityType: QualitySimulationType;
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

export type ExamplesDialogState = {
  type: "examples";
};

export type NetworkProjectionDialogState = {
  type: "networkProjection";
  source: "import" | "map-panel";
  previewGeoJson: FeatureCollection;
  onImportWithProjection: (projection: Projection, extent?: BBox) => void;
  filename: string;
  flowUnits: string;
  initialProjection?: Proj4Projection;
  suggestedXyScale?: number;
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

export type AlertExportInpState = {
  type: "alertExportInp";
  onSaveProject: () => void;
  onExportAnyway: () => void;
};

export type ProjectSavedInfoState = {
  type: "projectSavedInfo";
  onConfirm: () => void;
  onCancel?: () => void;
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
  phase: "hydraulic" | "quality" | "finalizing";
};

export type OpenProjectPhase =
  | "opening"
  | "reading-assets"
  | "reading-customer-points"
  | "reading-settings"
  | "building"
  | "finalizing";

export type OpenProjectProgressDialogState = {
  type: "openProjectProgress";
  phase: OpenProjectPhase;
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

export type PaywallFeature = "scenarios" | "elevations" | "customLayers";

export type FeaturePaywallDialogState = {
  type: "featurePaywall";
  feature: PaywallFeature;
};

export type ElevationTileErrorsDialogState = {
  type: "elevationTileErrors";
  totalCount: number;
  errors: { fileName: string; error: string }[];
};

export type GisImportErrorsDialogState = {
  type: "gisImportErrors";
  totalCount: number;
  errors: { fileName: string; error: string }[];
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

export type ExportDataDialogState = {
  type: "exportData";
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
  | ExamplesDialogState
  | InpIssuesDialogState
  | { type: "loading" }
  | AlertInpOutputState
  | AlertExportInpState
  | ProjectSavedInfoState
  | MissingCoordinatesDialogState
  | UpgradeDialogState
  | ImportCustomerPointsWizardState
  | ImportCustomerPointsWarningDialogState
  | UnexpectedErrorDialogState
  | ModelBuilderIframeDialogState
  | EarlyAccessDialogState
  | SimulationProgressDialogState
  | OpenProjectProgressDialogState
  | { type: "simulationSettings" }
  | { type: "controls" }
  | PatternsLibraryDialog
  | PumpLibraryDialogState
  | CurveLibraryDialogState
  | DeleteScenarioConfirmationDialogState
  | RenameScenarioDialogState
  | FeaturePaywallDialogState
  | ElevationTileErrorsDialogState
  | GisImportErrorsDialogState
  | FirstScenarioDialogState
  | AlertScenariosNotSavedState
  | AlertNetworkRequiredState
  | ActivatingTrialDialogState
  | ExportDataDialogState
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
