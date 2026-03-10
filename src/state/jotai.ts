import { atom, createStore } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { FileSystemHandle } from "browser-fs-access";
import type { SetOptional } from "type-fest";
import {
  FolderMap,
  LayerConfigMap,
  SYMBOLIZATION_NONE,
  Position,
} from "src/types";
import { Mode, MODE_INFO, modeAtom } from "src/state/mode";
import type { ExportOptions } from "src/types/export";
import { focusAtom } from "jotai-optics";
import { USelection } from "src/selection/selection";
import type { Sel } from "src/selection/types";
import { atomWithMachine } from "jotai-xstate";
import { createMachine } from "xstate";
import { PersistenceMetadataMemory } from "src/lib/persistence/ipersistence";
import { CustomerPoint } from "src/hydraulic-model/customer-points";
import { ScaleUnit } from "src/lib/constants";
import { EphemeralMoveAssets } from "src/map/mode-handlers/none/move-state";
import { MomentLog } from "src/lib/persistence/moment-log";
import { Quantities, presets } from "src/model-metadata/quantities-spec";
import { ModelMetadata } from "src/model-metadata";
import { createProjectionMapper } from "src/projections";
import { EphemeralDrawNode } from "src/map/mode-handlers/draw-node/ephemeral-draw-node-state";
import { DEFAULT_ZOOM } from "src/map/map-engine";
import { EphemeralDrawLink } from "src/map/mode-handlers/draw-link/ephemeral-link-state";
import { EphemeralEditingStateAreaSelection } from "src/map/mode-handlers/area-selection/ephemeral-area-selection-state";
import type { SimulationIds } from "src/simulation/epanet/simulation-metadata";
import { stagingModelAtom } from "src/state/hydraulic-model";

export {
  stagingModelAtom,
  assetsAtom,
  customerPointsAtom,
  nullHydraulicModel,
} from "src/state/hydraulic-model";

export { modelFactoriesAtom } from "src/state/model-factories";

export { simulationResultsAtom } from "src/state/simulation";
export { simulationSettingsAtom } from "src/state/simulation-settings";

export type Store = ReturnType<typeof createStore>;

// TODO: make this specific
type MapboxLayer = any;

export type FileInfo = {
  name: string;
  modelVersion: string;
  handle?: FileSystemHandle | FileSystemFileHandle;
  isMadeByApp: boolean;
  isDemoNetwork: boolean;
  options: ExportOptions;
};

export type PreviewProperty = PersistenceMetadataMemory["label"];

// ----------------------------------------------------------------------------
//

export type SimulationIdle = { status: "idle" };
export type SimulationFinished = {
  status: "success" | "failure" | "warning";
  report: string;
  modelVersion: string;
  settingsVersion: string;
  metadata?: ArrayBuffer;
  simulationIds?: SimulationIds;
  currentTimestepIndex?: number;
};
export type SimulationRunning = {
  status: "running";
};

export type SimulationState =
  | SimulationIdle
  | SimulationFinished
  | SimulationRunning;

export const initialSimulationState: SimulationIdle = {
  status: "idle",
};

export const simulationAtom = atom<SimulationState>(initialSimulationState);

/**
 * Core data
 */
export interface Data {
  folderMap: FolderMap;
  selection: Sel;
  modelMetadata: ModelMetadata;
}

const quantities = new Quantities(presets.LPS);
const modelMetadata: ModelMetadata = {
  quantities,
  projectionMapper: createProjectionMapper({ type: "wgs84" }),
};
export const nullData: Data = {
  folderMap: new Map(),
  selection: {
    type: "none",
  },
  modelMetadata,
};
export const dataAtom = atom<Data>(nullData);

export const isUnprojectedAtom = atom((get) => {
  return get(dataAtom).modelMetadata.projectionMapper.projection === "xy-grid";
});

export const gridPreviewAtom = atom(false);
export const gridHiddenAtom = atom(false);

export const showGridAtom = atom((get) => {
  if (get(gridHiddenAtom)) return false;
  return get(isUnprojectedAtom) || get(gridPreviewAtom);
});

export const layerConfigAtom = atom<LayerConfigMap>(new Map());

export const satelliteModeOnAtom = atom<boolean>((get) => {
  if (get(showGridAtom)) return false;
  const layersConfig = get(layerConfigAtom);
  return [...layersConfig.values()].some((layer) => layer.name === "Satellite");
});

export const selectedFeaturesAtom = atom((get) => {
  const data = get(dataAtom);
  const hydraulicModel = get(stagingModelAtom);
  return USelection.getSelectedFeatures({ ...data, hydraulicModel });
});

export const selectionAtom = focusAtom(dataAtom, (optic) =>
  optic.prop("selection"),
);

export const hasUnsavedChangesAtom = atom<boolean>((get) => {
  const fileInfo = get(fileInfoAtom);
  const momentLog = get(momentLogAtom);
  const hydraulicModel = get(stagingModelAtom);

  if (fileInfo) {
    return fileInfo.modelVersion !== hydraulicModel.version;
  }

  return momentLog.getDeltas().length > 0;
});

export const memoryMetaAtom = atom<Omit<PersistenceMetadataMemory, "type">>({
  symbology: SYMBOLIZATION_NONE,
  label: null,
  layer: null,
});

// ----------------------------------------------------------------------------
/**
 * Split
 */
export type Side = "left" | "right";

export const OTHER_SIDE: Record<Side, Side> = {
  left: "right",
  right: "left",
};

/**
 * The separation between the map and the pane, which can
 * be controlled by dragging the resizer
 */
export const MIN_SPLITS = {
  left: 150,
  right: 260,
} as const;
export const MAX_SPLIT = 640;

export interface Splits {
  layout: PanelLayout;
  bottom: number | string;
  rightOpen: boolean;
  right: number;
  leftOpen: boolean;
  left: number;
}

export type PanelLayout = "AUTO" | "FLOATING" | "VERTICAL";

export const defaultSplits: Splits = {
  layout: "AUTO",
  bottom: "50%",
  rightOpen: true,
  right: 320,
  leftOpen: false,
  left: 300,
};
export const splitsAtom = atom<Splits>(defaultSplits);

export const showPanelBottomAtom = atom<boolean>(true);

export const currentZoomAtom = atom<number>(DEFAULT_ZOOM);

// ----------------------------------------------------------------------------
/**
 * Other UI state
 */
export const hideHintsAtom = atomWithStorage<string[]>("hideHints", []);

export const scaleUnitAtom = atomWithStorage<ScaleUnit>(
  "scaleUnit",
  "imperial",
);

// ----------------------------------------------------------------------------
/**
 * Modal state
 */
export { dialogAtom as dialogAtom } from "src/state/dialog";
/**
 * Current layer state
 * TODO: move to server
 */
export type PartialLayer = SetOptional<MapboxLayer, "createdById">;

export const momentLogAtom = atom<MomentLog>(new MomentLog());

export type CursorValue = React.CSSProperties["cursor"];
export const cursorStyleAtom = atom<CursorValue>("default");

export type EphemeralMoveCustomerPoint = {
  type: "moveCustomerPoint";
  customerPoint: CustomerPoint;
  movedCoordinates: Position;
  startPoint?: { x: number; y: number };
  moveActivated: boolean;
};

export type EphemeralCustomerPointsHighlight = {
  type: "customerPointsHighlight";
  customerPoints: CustomerPoint[];
};

export type EphemeralConnectCustomerPoints = {
  type: "connectCustomerPoints";
  customerPoints: CustomerPoint[];
  targetPipeId?: number;
  snapPoints: Position[];
  strategy: "nearest-to-point" | "cursor";
};

export type EphemeralEditingState =
  | EphemeralDrawLink
  | EphemeralDrawNode
  | EphemeralMoveAssets
  | EphemeralMoveCustomerPoint
  | EphemeralCustomerPointsHighlight
  | EphemeralConnectCustomerPoints
  | EphemeralEditingStateAreaSelection
  | { type: "none" };

export const ephemeralStateAtom = atom<EphemeralEditingState>({ type: "none" });

export { Mode, MODE_INFO, modeAtom };

/**
 * File info
 */
export const fileInfoAtom = atom<FileInfo | null>(null);
export const isDemoNetworkAtom = atom(
  (get) => get(fileInfoAtom)?.isDemoNetwork ?? false,
);

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

export enum TabOption {
  Asset = "Asset",
  Map = "Map",
}

export const tabAtom = atom<TabOption>(TabOption.Asset);

export type MultiAssetPanelCollapse = {
  junction: boolean;
  pipe: boolean;
  pump: boolean;
  valve: boolean;
  reservoir: boolean;
  tank: boolean;
};

export const multiAssetPanelCollapseAtom =
  atomWithStorage<MultiAssetPanelCollapse>("multiAssetPanelCollapse", {
    junction: true,
    pipe: true,
    pump: true,
    valve: true,
    reservoir: true,
    tank: true,
  });

export const pumpEnergySectionsCollapseAtom = atomWithStorage(
  "pumpEnergySectionsCollapse",
  { energy: false, energyResults: false },
);

export const pipeDrawingDefaultsAtom = atom<{
  diameter?: number;
  roughness?: number;
}>({});

export const autoElevationsAtom = atom<boolean>(true);
