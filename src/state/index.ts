// Data
export type { Data } from "src/state/data";
export { nullData, dataAtom } from "src/state/data";

// Dialog
export type { DialogState } from "src/state/dialog";
export { dialogFromUrl, dialogAtom } from "src/state/dialog";

// Drawing options
export type {
  EphemeralMoveCustomerPoint,
  EphemeralCustomerPointsHighlight,
  EphemeralConnectCustomerPoints,
  EphemeralEditingState,
} from "src/state/drawing";
export {
  ephemeralStateAtom,
  pipeDrawingDefaultsAtom,
  autoElevationsAtom,
} from "src/state/drawing";

// File system
export type { FileInfo } from "src/state/file-system";
export { fileInfoAtom, isDemoNetworkAtom } from "src/state/file-system";

// Hydraulic model
export {
  nullHydraulicModel,
  stagingModelAtom,
  baseModelAtom,
  assetsAtom,
  patternsAtom,
  customerPointsAtom,
} from "src/state/hydraulic-model";

// Layout
export type {
  Side,
  Splits,
  PanelLayout,
  MultiAssetPanelCollapse,
} from "src/state/layout";
export {
  OTHER_SIDE,
  MIN_SPLITS,
  MAX_SPLIT,
  defaultSplits,
  splitsAtom,
  showPanelBottomAtom,
  TabOption,
  tabAtom,
  multiAssetPanelCollapseAtom,
  assetPanelSectionsExpandedAtom,
} from "src/state/layout";

// Locale
export { localeAtom } from "src/state/locale";

// Map
export type { MomentPointer, CursorValue, PartialLayer } from "src/state/map";
export {
  mapSyncMomentAtom,
  mapLoadingAtom,
  currentZoomAtom,
  layerConfigAtom,
  satelliteModeOnAtom,
  cursorStyleAtom,
} from "src/state/map";

// Map projection
export {
  isUnprojectedAtom,
  gridPreviewAtom,
  gridHiddenAtom,
  showGridAtom,
} from "src/state/map-projection";

// Map symbology
export type { SymbologySpec, PreviewProperty } from "src/state/map-symbology";
export {
  memoryMetaAtom,
  savedSymbologiesAtom,
  symbologyAtom,
  useSymbologyState,
} from "src/state/map-symbology";

// Mode
export type { ModeWithOptions } from "src/state/mode";
export {
  Mode,
  MODE_INFO,
  modeAtom,
  lastSelectionModeAtom,
  lastTraceSelectModeAtom,
} from "src/state/mode";

// Model changes
export { momentLogAtom, hasUnsavedChangesAtom } from "src/state/model-changes";

// Model factories
export type { ModelFactories } from "src/state/model-factories";
export { modelFactoriesAtom } from "src/state/model-factories";

// Offline
export { offlineAtom } from "src/state/offline";

// Quick graph
export type {
  QuickGraphPropertyByAssetType,
  QuickGraphAssetType,
} from "src/state/quick-graph";
export {
  DEFAULT_FOOTER_HEIGHT,
  assetPanelFooterAtom,
  quickGraphPropertyAtom,
} from "src/state/quick-graph";

// Scenarios
export type { Worktree, Snapshot } from "src/state/scenarios";
export {
  initialWorktree,
  worktreeAtom,
  scenariosListAtom,
  hasScenariosAtom,
} from "src/state/scenarios";

// Selection
export { selectionAtom, selectedFeaturesAtom } from "src/state/selection";

// Simulation
export type {
  SimulationIdle,
  SimulationFinished,
  SimulationRunning,
  SimulationState,
} from "src/state/simulation";
export {
  simulationResultsAtom,
  initialSimulationState,
  simulationStepAtom,
  simulationAtom,
} from "src/state/simulation";

// Simulation settings
export { simulationSettingsAtom } from "src/state/simulation-settings";

// Translation overrides
export type { TranslationOverride } from "src/state/translation-overrides";
export { translationOverridesAtom } from "src/state/translation-overrides";

// Store
export type { Store } from "src/state/store";

// User settings
export type { UserSettings } from "src/state/user-settings";
export {
  defaultUserSettings,
  userSettingsAtom,
  hideHintsAtom,
  settingsFromStorage,
} from "src/state/user-settings";
