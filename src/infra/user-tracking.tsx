import { PostHogProvider, usePostHog } from "posthog-js/react";
import { useCallback, useMemo } from "react";
import { Asset, HeadlossFormula } from "src/hydraulic-model";
import { isDebugOn } from "./debug-mode";
import { MODE_INFO, SimulationState } from "src/state/jotai";
import { Presets } from "src/model-metadata/quantities-spec";
import { EpanetUnitSystem } from "src/simulation/build-inp";
import { User } from "src/auth-types";
import { usePrivacySettings } from "src/hooks/use-privacy-settings";

type Metadata = {
  [key: string]: boolean | string | number | string[];
};

export const trackUserAction = (event: string, metadata: Metadata = {}) => {
  if (process.env.NEXT_PUBLIC_SKIP_USER_TRACKING === "true") return;

  // eslint-disable-next-line no-console
  console.log(`USER_TRACKING: ${event}`, metadata);
};

const getApiHost = (): string => {
  if (typeof window === "undefined")
    return process.env.NEXT_PUBLIC_POSTHOG_HOST as string;

  const isProxyEnabled = process.env.NEXT_PUBLIC_POSTHOG_PROXY === "true";

  return isProxyEnabled
    ? `${window.location.origin}/i`
    : (process.env.NEXT_PUBLIC_POSTHOG_HOST as string);
};

const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY as string;
const options = {
  api_host: getApiHost(),
};

export const isPosthogConfigured = !!apiKey;

export const UserTrackingProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  if (!isPosthogConfigured) return children as JSX.Element;

  return (
    <PostHogProvider apiKey={apiKey} options={options}>
      {children}
    </PostHogProvider>
  );
};

type AssetCreated = {
  name: "asset.created";
  type: Asset["type"];
};

type AssetRedrawed = {
  name: "asset.redrawed";
  type: Asset["type"];
};

type AssetRedrawStarted = {
  name: "asset.redrawStarted";
  source: "context-menu" | "toolbar" | "shortcut";
  type: Asset["type"];
};

type LinkReversed = {
  name: "link.reversed";
  source: "context-menu" | "toolbar" | "shortcut";
  type: Asset["type"];
};

type AssetPropertyEdited = {
  name: "assetProperty.edited";
  type: Asset["type"];
  property: string;
  newValue: number | string | null;
  oldValue: number | string | null;
};

type AssetStatusEdited = {
  name: "assetStatus.edited";
  type: Asset["type"];
  property: string;
  newStatus: string | null;
  oldStatus: string | null;
};

type AssetDefinitionTypeEdited = {
  name: "assetDefinitionType.edited";
  type: Asset["type"];
  property: string;
  newType: string | null;
  oldType?: string | null;
};

type PumpCurveEdited = {
  name: "pumpType.edited";
  definitionType: string;
  pointsCount: number;
};

type AssetSelected = {
  name: "asset.selected";
  type: Asset["type"];
};

type MultiSelectUpdated = {
  name: "multiSelect.updated";
  count: number;
  operation:
    | "bulk_add"
    | "bulk_remove"
    | "new"
    | "single_add"
    | "single_remove";
};

type FullSelectionEnabled = {
  name: "fullSelection.enabled";
  source: "shortcut";
  count: number;
};

type SelectionCleared = {
  name: "selection.cleared";
};

type AssetDeselected = {
  name: "asset.deselected";
  type: Asset["type"];
};

type SatelliteViewToggled = {
  name: "satelliteView.toggled";
  source: "button" | "shortcut";
};

export type AssetDeleted = {
  name: "asset.deleted";
  source: "shortcut" | "toolbar" | "context-menu";
  type: Asset["type"];
};

export type AssetsDeleted = {
  name: "assets.deleted";
  source: "shortcut" | "toolbar" | "context-menu";
  count: number;
};

export type AssetsIncludedInActiveTopology = {
  name: "assets.includedInActiveTopology";
  source: "shortcut" | "toolbar" | "context-menu";
  count: number;
};

export type AssetsExcludedFromActiveTopology = {
  name: "assets.excludedFromActiveTopology";
  source: "shortcut" | "toolbar" | "context-menu";
  count: number;
};

type WelcomeSeen = {
  name: "welcome.seen";
};

export type WelcomeOpened = {
  name: "welcome.opened";
  source:
    | "menu"
    | "inpIssues"
    | "geocodeError"
    | "missingCoordinatesError"
    | "invalidFilesError"
    | "toolbar";
};

type ModelBuilderOpened = {
  name: "modelBuilder.opened";
  source: string;
};
type ModelBuilderCompleted = {
  name: "modelBuilder.completed";
};

type ExamplesOpened = {
  name: "examples.opened";
  source: string;
};

type ProjectionConverterVisited = {
  name: "projectionConverter.visited";
};

type WelcomeHidden = {
  name: "welcome.hidden";
};

type WelcomeEnabled = {
  name: "welcome.enabled";
};

type ExampleModelClicked = {
  name: "exampleModel.clicked";
  modelName: string;
};

type SimulationExecuted = {
  name: "simulation.executed";
  source: "shortcut" | "toolbar";
};

type SimulationTimestepChanged = {
  name: "simulation.timestep.changed";
  timestepIndex: number;
  source: "previous" | "next" | "dropdown";
};

type ReportOpened = {
  name: "report.opened";
  source: "shortcut" | "resultDialog" | "toolbar";
  status: SimulationState["status"];
};

export type OpenInpStarted = {
  name: "openInp.started";
  source: string;
};

export type ImportInpCompleted = {
  name: "importInp.completed";
  counts: Record<string, number>;
  headlossFormula: HeadlossFormula;
  units: EpanetUnitSystem;
  issues: (
    | "unsupportedSections"
    | "nodesMissingCoordinates"
    | "invalidVertices"
    | "invalidCoordinates"
    | "nonDefaultOptions"
    | "nonDefaultTimes"
    | "unbalancedDiff"
    | "hasReservoirPatterns"
    | "hasTankCurves"
    | "hasPumpPatterns"
    | "hasPumpCurves"
    | "hasPCVCurves"
    | "hasControls"
    | "hasRules"
    | "hasWaterAge"
    | "hasWaterChemical"
    | "hasWaterTrace"
  )[];
};

type FilesDropped = {
  name: "files.dropped";
  count: number;
  filenames: string[];
  extensions: (string | null)[];
};

type DownloadErrorSeen = {
  name: "downloadError.seen";
};

type NewModelStarted = {
  name: "newModel.started";
  source: string;
};

type NewModelCompleted = {
  name: "newModel.completed";
  units: keyof Presets;
  headlossFormula: HeadlossFormula;
  location: string;
};

type ModelSaved = {
  name: "model.saved";
  source: string;
  isSaveAs?: boolean;
};

type OperationUndone = {
  name: "operation.undone";
  source: "shortcut" | "toolbar";
};

type OperationRedone = {
  name: "operation.redone";
  source: "shortcut" | "toolbar";
};

type DrawingModeEnabled = {
  name: "drawingMode.enabled";
  source: "toolbar" | "shortcut";
  type: (typeof MODE_INFO)[keyof typeof MODE_INFO]["name"];
};

type UnsavedChangesSeen = {
  name: "unsavedChanges.seen";
};

type InpIssuesSeen = {
  name: "inpIssues.seen";
};
type InpIssuesExpanded = {
  name: "inpIssues.expanded";
};
type CoordinatesIssuesExpanded = {
  name: "coordinatesIssues.expanded";
};
type GeocodingNotSupportedSeen = {
  name: "geocodingNotSupported.seen";
};
type MissingCoordinatesSeen = {
  name: "missingCoordinates.seen";
};
type InvalidFilesErrorSeen = {
  name: "invalidFilesError.seen";
};

type SimulationSummarySeen = {
  name: "simulationSummary.seen";
  status: SimulationState["status"];
  duration?: number;
};

type ShortcutsOpened = {
  name: "shortcuts.opened";
  source: "menu" | "shortcut" | "onboarding";
};

type PropertyAggregateOpened = {
  name: "propertyAggregate.opened";
  property: string;
};

type QuickStartVisited = {
  name: "quickStart.visited";
  source: "welcome";
};

type HelpCenterVisited = {
  name: "helpCenter.visited";
  source: "welcome" | "menu" | "educationPlan";
};

type RoadmapVisited = {
  name: "roadmap.visited";
  source: "menu";
};

type UtilitiesVisited = {
  name: "utilities.visited";
  source: "menu";
};

type RepoVisited = {
  name: "repo.visited";
  source: "welcome" | "menu";
};

type SignInStarted = {
  name: "signIn.started";
  source: "menu";
};

type SignUpStarted = {
  name: "signUp.started";
  source: "menu";
};

type LogOutCompleted = {
  name: "logOut.completed";
};

type SubscriptionStarted = {
  name: "subscription.started";
  source: "geocodeError" | "inpIssues";
};

type PageReloaded = {
  name: "page.reloaded";
  source: "errorFallback";
};

type LayersPopoverOpened = {
  name: "layersPopover.opened";
  source: "toolbar";
};

type LayerOpacityChanged = {
  name: "layerOpacity.changed";
  oldValue: number;
  newValue: number;
  type: string;
};

type LanguageListOpened = {
  name: "languageList.opened";
};

type LanguageChanged = {
  name: "language.changed";
  language: string;
};

type ImportCustomerPointsStarted = {
  name: "importCustomerPoints.started";
  source: string;
};

type ImportCustomerPointsCompleted = {
  name: "importCustomerPoints.completed";
  count: number;
  rulesCount: number;
  allocatedCount: number;
  disconnectedCount: number;
};

type ImportCustomerPointsCanceled = {
  name: "importCustomerPoints.canceled";
};

type ImportCustomerPointsAllocationRulesEditStarted = {
  name: "importCustomerPoints.allocationRules.editStarted";
  rulesCount: number;
};

type ImportCustomerPointsAllocationRulesSaved = {
  name: "importCustomerPoints.allocationRules.saved";
  rulesCount: number;
  allocatedCount: number;
  disconnectedCount: number;
};

type ImportCustomerPointsAllocationRulesEditCanceled = {
  name: "importCustomerPoints.allocationRules.editCanceled";
};

type ImportCustomerPointsDataInputNoValidPoints = {
  name: "importCustomerPoints.dataInput.noValidPoints";
  fileName: string;
};

type ImportCustomerPointsDataInputParseError = {
  name: "importCustomerPoints.dataInput.parseError";
  fileName: string;
  errorCode?: string;
};

type ImportCustomerPointsDataInputUnsupportedFormat = {
  name: "importCustomerPoints.dataInput.unsupportedFormat";
  fileName: string;
};

type ImportCustomerPointsDataInputCustomerPointsLoaded = {
  name: "importCustomerPoints.dataInput.customerPointsLoaded";
  validCount: number;
  totalCount: number;
  issuesCount: number;
  fileName: string;
};

type ImportCustomerPointsDataSelectDemandProperty = {
  name: "importCustomerPoints.dataMapping.selectDemand";
  property: string;
};

type ImportCustomerPointsDataSelectLabelProperty = {
  name: "importCustomerPoints.dataMapping.selectLabel";
  property: string;
};

type ImportCustomerPointsDataInputSchemaExtracted = {
  name: "importCustomerPoints.dataInput.next";
  fileName: string;
  propertiesCount: number;
  featuresCount: number;
};

type ImportCustomerPointsDataInputFileLoaded = {
  name: "importCustomerPoints.dataInput.fileLoaded";
  fileName: string;
  propertiesCount: number;
  featuresCount: number;
  coordinateConversion: {
    detected: string;
    converted: boolean;
    fromCRS: string;
  } | null;
};

type ImportCustomerPointsDataMappingNoValidPoints = {
  name: "importCustomerPoints.dataMapping.noValidPoints";
  fileName: string;
};

type ImportCustomerPointsDataMappingParseError = {
  name: "importCustomerPoints.dataMapping.parseError";
  fileName: string;
};

type ImportCustomerPointsDataMappingCustomerPointsLoaded = {
  name: "importCustomerPoints.dataMapping.customerPointsLoaded";
  validCount: number;
  totalCount: number;
  issuesCount: number;
  fileName: string;
};

type ImportCustomerPointsDemandOptionsSelected = {
  name: "importCustomerPoints.demandOptions.selected";
  option: "replace" | "addOnTop";
};

type ImportCustomerPointsWizardNext = {
  name:
    | "importCustomerPoints.dataInput.next"
    | "importCustomerPoints.dataMapping.next"
    | "importCustomerPoints.demandOptions.next"
    | "importCustomerPoints.allocation.next";
};

type ImportCustomerPointsWizardBack = {
  name:
    | "importCustomerPoints.dataInput.back"
    | "importCustomerPoints.dataMapping.back"
    | "importCustomerPoints.demandOptions.back"
    | "importCustomerPoints.allocation.back";
};

type ImportCustomerPointsWizardCancel = {
  name:
    | "importCustomerPoints.dataInput.cancel"
    | "importCustomerPoints.dataMapping.cancel"
    | "importCustomerPoints.demandOptions.cancel"
    | "importCustomerPoints.allocation.cancel";
};

type ImportCustomerPointsWarningDialogProceed = {
  name: "importCustomerPoints.warningDialog.proceed";
};

type ImportCustomerPointsWarningDialogCancel = {
  name: "importCustomerPoints.warningDialog.cancel";
};

type EarlyAccessClickedGet = {
  name: "earlyAccess.clickedGet";
  source: "earlyAccessDialog";
};

type CustomerPointsConnectStarted = {
  name: "customerPointActions.connectStarted";
  count: number;
  source: string;
};

type CustomerPointsReconnectStarted = {
  name: "customerPointActions.reconnectStarted";
  count: number;
  source: string;
};

type CustomerPointsDisconnected = {
  name: "customerPointActions.disconnected";
  count: number;
  source: string;
};

type CustomerPointsConnectedCompleted = {
  name: "customerPoints.connected";
  count: number;
  strategy: "nearest-to-point" | "cursor";
};

type SimulationReportAssetClicked = {
  name: "simulationReport.assetClicked";
  assetType: Asset["type"] | null;
};

type NetworkReviewOpened = {
  name: "networkReview.opened";
  source: string;
};

type NetworkReviewClosed = {
  name: "networkReview.closed";
  source: string;
};

type NetworkReviewChecked = {
  name:
    | "networkReview.orphanAssets.opened"
    | "networkReview.proximityAnomalies.opened"
    | "networkReview.connectivityTrace.opened"
    | "networkReview.crossingPipes.opened";
};

type NetworkReviewChanged =
  | {
      name:
        | "networkReview.orphanAssets.changed"
        | "networkReview.connectivityTrace.changed"
        | "networkReview.crossingPipes.changed";
      count: number;
    }
  | {
      name: "networkReview.proximityAnomalies.changed";
      count: number;
      distance: number;
      units: string;
    };

type NetworkReviewBack = {
  name:
    | "networkReview.orphanAssets.back"
    | "networkReview.proximityAnomalies.back"
    | "networkReview.connectivityTrace.back"
    | "networkReview.crossingPipes.back";
  count: number;
};

type SidePanelOpened = {
  name: "sidePanel.opened";
  source: string;
};

type SidePanelClosed = {
  name: "sidePanel.closed";
  source: string;
};

export type UserEvent =
  | AssetCreated
  | AssetRedrawed
  | AssetRedrawStarted
  | LinkReversed
  | AssetSelected
  | AssetDeselected
  | AssetPropertyEdited
  | AssetStatusEdited
  | AssetDefinitionTypeEdited
  | PumpCurveEdited
  | SatelliteViewToggled
  | AssetsDeleted
  | AssetDeleted
  | AssetsIncludedInActiveTopology
  | AssetsExcludedFromActiveTopology
  | WelcomeSeen
  | WelcomeOpened
  | WelcomeHidden
  | WelcomeEnabled
  | UnsavedChangesSeen
  | ExampleModelClicked
  | SimulationExecuted
  | SimulationTimestepChanged
  | ReportOpened
  | OpenInpStarted
  | ImportInpCompleted
  | FilesDropped
  | InvalidFilesErrorSeen
  | DownloadErrorSeen
  | NewModelStarted
  | NewModelCompleted
  | ModelSaved
  | OperationUndone
  | OperationRedone
  | DrawingModeEnabled
  | MultiSelectUpdated
  | FullSelectionEnabled
  | SelectionCleared
  | InpIssuesSeen
  | InpIssuesExpanded
  | CoordinatesIssuesExpanded
  | MissingCoordinatesSeen
  | GeocodingNotSupportedSeen
  | SimulationSummarySeen
  | ShortcutsOpened
  | PropertyAggregateOpened
  | QuickStartVisited
  | HelpCenterVisited
  | RoadmapVisited
  | UtilitiesVisited
  | RepoVisited
  | SignUpStarted
  | SignInStarted
  | LogOutCompleted
  | SubscriptionStarted
  | ProjectionConverterVisited
  | PageReloaded
  | LayersPopoverOpened
  | LayerOpacityChanged
  | LanguageListOpened
  | LanguageChanged
  | ImportCustomerPointsStarted
  | ImportCustomerPointsCompleted
  | ImportCustomerPointsCanceled
  | ImportCustomerPointsAllocationRulesEditStarted
  | ImportCustomerPointsAllocationRulesSaved
  | ImportCustomerPointsAllocationRulesEditCanceled
  | ImportCustomerPointsDataInputNoValidPoints
  | ImportCustomerPointsDataInputParseError
  | ImportCustomerPointsDataInputUnsupportedFormat
  | ImportCustomerPointsDataInputCustomerPointsLoaded
  | ImportCustomerPointsDataInputSchemaExtracted
  | ImportCustomerPointsDataInputFileLoaded
  | ImportCustomerPointsDataMappingNoValidPoints
  | ImportCustomerPointsDataMappingParseError
  | ImportCustomerPointsDataMappingCustomerPointsLoaded
  | ImportCustomerPointsDemandOptionsSelected
  | ImportCustomerPointsWizardNext
  | ImportCustomerPointsWizardBack
  | ImportCustomerPointsWizardCancel
  | ImportCustomerPointsWarningDialogProceed
  | ImportCustomerPointsWarningDialogCancel
  | EarlyAccessClickedGet
  | CustomerPointsConnectStarted
  | CustomerPointsReconnectStarted
  | CustomerPointsDisconnected
  | CustomerPointsConnectedCompleted
  | SimulationReportAssetClicked
  | ModelBuilderOpened
  | ModelBuilderCompleted
  | ExamplesOpened
  | ImportCustomerPointsDataSelectDemandProperty
  | ImportCustomerPointsDataSelectLabelProperty
  | NetworkReviewOpened
  | NetworkReviewClosed
  | NetworkReviewChecked
  | NetworkReviewBack
  | NetworkReviewChanged
  | SidePanelOpened
  | SidePanelClosed
  | { name: "map.labels.shown"; type: string; subtype: string }
  | { name: "map.labels.hidden"; type: string }
  | { name: "map.customerPoints.shown" }
  | { name: "map.customerPoints.hidden" }
  | { name: "map.colorBy.changed"; type: string; subtype: string }
  | { name: "map.colorRamp.changed"; rampName: string; property: string }
  | { name: "map.colorRamp.reversed"; rampName: string; property: string }
  | { name: "colorRange.rangeMode.changed"; mode: string; property: string }
  | {
      name: "colorRange.classes.changed";
      classesCount: number;
      property: string;
    }
  | { name: "colorRange.break.updated"; breakValue: number; property: string }
  | { name: "colorRange.break.prepended"; property: string }
  | { name: "colorRange.break.appended"; property: string }
  | { name: "colorRange.break.deleted"; property: string }
  | { name: "colorRange.intervalColor.changed"; property: string }
  | { name: "colorRange.breaks.regenerated"; property: string }
  | {
      name: "colorRange.rangeError.seen";
      property: string;
      errorKey: string;
      mode: string;
      classesCount: number;
    }
  | { name: "legend.clicked"; property: string }
  | { name: "layerLabelVisibility.changed"; visible: boolean; type: string }
  | { name: "layer.removed"; type: string }
  | { name: "layerVisibility.changed"; visible: boolean; type: string }
  | { name: "customLayer.added"; type: string }
  | { name: "addCustomLayer.clicked" }
  | { name: "layerType.choosen"; type: string }
  | { name: "checkout.started"; plan: string; paymentType: string }
  | { name: "studentLogin.clicked" }
  | { name: "planUsage.toggled" }
  | { name: "planPaymentType.toggled" }
  | {
      name: "upgradeButton.clicked";
      source: "menu" | "customLayers";
    }
  | { name: "simulationSettings.opened"; source: string }
  | { name: "controls.opened"; source: string }
  | { name: "assetControls.opened"; source: string }
  | {
      name: "simulationSetting.changed";
      settingName: string;
      newValue: number;
      oldValue: number;
    }
  | { name: "teamsRequest.clicked" }
  | {
      name: "baseMap.changed";
      oldBasemap: string;
      newBasemap: string;
      source: "dropdown" | "popover";
    }
  | {
      name: "pipeDrawingDefaults.changed";
      property: "diameter" | "roughness";
      newValue: number;
    }
  | { name: "unexpectedError.seen" }
  | { name: "fitMapToNetworkExtent.clicked" }
  | {
      name: "controls.changed";
      simpleControlsCount: number;
      rulesCount: number;
    };

const debugPostHog = {
  capture: (...data: any[]) => {
    // eslint-disable-next-line
    console.log("USER_TRACKING:CAPTURE", ...data);
  },
  identify: (...data: any[]) => {
    // eslint-disable-next-line
    console.log("USER_TRACKING:IDENTIFY", ...data);
  },
  reset: () => {
    // eslint-disable-next-line
    console.log("USER_TRACKING:RESET");
  },
};

export const useUserTracking = () => {
  const posthog = usePostHog();
  const { privacySettings } = usePrivacySettings();

  const isAnalyticsDisabled = privacySettings?.skipAnalytics === true;

  const capture = useCallback(
    (event: UserEvent) => {
      if (isAnalyticsDisabled) return;
      const { name, ...metadata } = event;

      posthog.capture(name, metadata);
      isDebugOn && debugPostHog.capture(name, metadata);
    },
    [posthog, isAnalyticsDisabled],
  );

  const identify = useCallback(
    (user: User) => {
      const properties = {
        email: user.email,
        first_name: user.firstName,
        last_name: user.lastName,
      };

      posthog.identify(user.id || "", properties);
      isDebugOn && debugPostHog.identify(user.id, properties);
    },
    [posthog],
  );

  const isIdentified = useCallback(() => {
    return posthog._isIdentified();
  }, [posthog]);

  const reset = useCallback(() => {
    posthog.reset();
    isDebugOn && debugPostHog.reset();
  }, [posthog]);

  const reloadFeatureFlags = useCallback(() => {
    if (posthog?.reloadFeatureFlags) {
      posthog.reloadFeatureFlags();
    }
  }, [posthog]);

  return useMemo(
    () => ({ identify, capture, isIdentified, reset, reloadFeatureFlags }),
    [identify, capture, isIdentified, reset, reloadFeatureFlags],
  );
};
