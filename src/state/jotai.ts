import { atom, createStore } from "jotai";
import { atomWithStorage, selectAtom } from "jotai/utils";
import type { FileSystemHandle } from "browser-fs-access";
import type { SetOptional } from "type-fest";
import {
  FolderMap,
  IFolder,
  IPresence,
  IWrappedFeature,
  LayerConfigMap,
  SYMBOLIZATION_NONE,
  Position,
} from "src/types";
import { Mode, MODE_INFO, modeAtom, CIRCLE_TYPE } from "src/state/mode";
import type { ExportOptions } from "src/types/export";
import { focusAtom } from "jotai-optics";
import { USelection } from "src/selection/selection";
import { atomWithMachine } from "jotai-xstate";
import { createMachine } from "xstate";
import { QItemAddable } from "src/lib/geocode";
import { PersistenceMetadataMemory } from "src/lib/persistence/ipersistence";
import { CustomerPoint } from "src/hydraulic-model/customer-points";
import { ScaleUnit } from "src/lib/constants";
import { HydraulicModel } from "src/hydraulic-model";
import { EphemeralMoveAssets } from "src/map/mode-handlers/none/move-state";
import { MomentLog } from "src/lib/persistence/moment-log";
import { Quantities, presets } from "src/model-metadata/quantities-spec";
import { initializeHydraulicModel } from "src/hydraulic-model";
import { ModelMetadata } from "src/model-metadata";
import { EphemeralDrawNode } from "src/map/mode-handlers/draw-node/ephemeral-draw-node-state";
import { DEFAULT_ZOOM } from "src/map/map-engine";
import { EphemeralDrawLink } from "src/map/mode-handlers/draw-link/ephemeral-link-state";
import { PipeStatus } from "src/hydraulic-model/asset-types/pipe";

export type Store = ReturnType<typeof createStore>;

// TODO: make this specific
type MapboxLayer = any;

export type FileInfo = {
  name: string;
  modelVersion: string;
  handle?: FileSystemHandle | FileSystemFileHandle;
  isMadeByApp: boolean;
  options: ExportOptions;
};

type WalkthroughState =
  | {
      type: "idle";
    }
  | {
      type: "active";
      index: number;
    };

export const walkthroughAtom = atom<WalkthroughState>({
  type: "active",
  index: 0,
});

export type PreviewProperty = PersistenceMetadataMemory["label"];

// ----------------------------------------------------------------------------
//

export type SimulationIdle = { status: "idle" };
export type SimulationFinished = {
  status: "success" | "failure" | "warning";
  report: string;
  modelVersion: string;
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
  hydraulicModel: HydraulicModel;
  modelMetadata: ModelMetadata;
}

const quantities = new Quantities(presets.LPS);
const modelMetadata = { quantities };
export const nullData: Data = {
  folderMap: new Map(),
  selection: {
    type: "none",
  },
  hydraulicModel: initializeHydraulicModel({
    units: quantities.units,
    defaults: quantities.defaults,
  }),
  modelMetadata,
};
export const dataAtom = atom<Data>(nullData);

export const layerConfigAtom = atom<LayerConfigMap>(new Map());

export const satelliteModeOnAtom = atom<boolean>((get) => {
  const layersConfig = get(layerConfigAtom);
  return [...layersConfig.values()].some((layer) => layer.name === "Satellite");
});

export const selectedFeaturesAtom = selectAtom(dataAtom, (data) => {
  return USelection.getSelectedFeatures(data);
});

export const assetsAtom = focusAtom(dataAtom, (optic) =>
  optic.prop("hydraulicModel").prop("assets"),
);

export const selectionAtom = focusAtom(dataAtom, (optic) =>
  optic.prop("selection"),
);

export const customerPointsAtom = focusAtom(dataAtom, (optic) =>
  optic.prop("hydraulicModel").prop("customerPoints"),
);

export const customerPointsMetaAtom = atom((get) => {
  const customerPoints = get(customerPointsAtom);
  const keys = Array.from(customerPoints.keys()).sort().join(",");
  return {
    count: customerPoints.size,
    keysHash: keys,
  };
});

export const hasUnsavedChangesAtom = atom<boolean>((get) => {
  const fileInfo = get(fileInfoAtom);
  const momentLog = get(momentLogAtom);
  const { hydraulicModel } = get(dataAtom);

  if (fileInfo) {
    return fileInfo.modelVersion !== hydraulicModel.version;
  }

  return momentLog.getDeltas().length > 0;
});

/**
 * User presences, keyed by user id
 */
export const presencesAtom = atom<{
  presences: Map<number, IPresence>;
}>({
  get presences() {
    return new Map();
  },
});

export const memoryMetaAtom = atom<Omit<PersistenceMetadataMemory, "type">>({
  symbology: SYMBOLIZATION_NONE,
  label: null,
  layer: null,
});

export const searchHistoryAtom = atom<string[]>([]);

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
export const listModeAtom = atomWithStorage<"grid" | "list">(
  "listMode",
  "grid",
);
export const showAllAtom = atomWithStorage("showAll", true);
export const panelIdOpen = atomWithStorage("panelIdOpen", false);
export const panelRawOpen = atomWithStorage("panelRawOpen", false);
export const panelExportOpen = atomWithStorage("panelExportOpen", false);
export const panelNullOpen = atomWithStorage("panelNullOpen", true);
export const panelCircleOpen = atomWithStorage("panelCircleOpen", true);
export const panelStyleOpen = atomWithStorage("panelStyleOpen", false);
export const panelSymbologyExportOpen = atomWithStorage(
  "panelSymbologyExportOpen",
  true,
);
export type PanelAtom = typeof panelIdOpen;

export const hideHintsAtom = atomWithStorage<string[]>("hideHints", []);

export const scaleUnitAtom = atomWithStorage<ScaleUnit>(
  "scaleUnit",
  "imperial",
);

export const showFolderTreeAtom = atomWithStorage<"hide" | "show">(
  "showFolderTree",
  "hide",
);

export const addMetadataWithGeocoderAtom = atomWithStorage(
  "addMetadataWithGeocoder",
  false,
);

export const followPresenceAtom = atom<IPresence | null>(null);

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

// ----------------------------------------------------------------------------
/**
 * Selection state
 */

/**
 * A selection of a single folder.
 */
export interface SelFolder {
  type: "folder";
  /**
   * The folder's id
   */
  id: StringId;
}

/**
 * A selection of a single feature.
 */
export interface SelSingle {
  type: "single";
  /**
   * The feature's id
   */
  id: StringId;
  parts: readonly VertexId[];
}

export interface SelMulti {
  type: "multi";
  ids: readonly StringId[];
  previousIds?: readonly StringId[];
}

export interface SelSingleCustomerPoint {
  type: "singleCustomerPoint";
  /**
   * The customer point's id
   */
  id: StringId;
}

/**
 * This is not an abbreviation, it is named Sel
 * instead of Selection for safety: otherwise
 * window.Selection will sneak in if you don't
 * import the type.
 */
export type Sel =
  | SelMulti
  | SelFolder
  | {
      type: "none";
    }
  | SelSingle
  | SelSingleCustomerPoint;

export const SELECTION_NONE: Sel = {
  type: "none",
};

// ----------------------------------------------------------------------------

export interface EphemeralDragState {
  type: "drag";
  features: IWrappedFeature[];
}

export type CursorValue = React.CSSProperties["cursor"];
export const cursorStyleAtom = atom<CursorValue>("default");

export type EphemeralCustomerPointsHighlight = {
  type: "customerPointsHighlight";
  customerPoints: CustomerPoint[];
};

export type EphemeralConnectCustomerPoints = {
  type: "connectCustomerPoints";
  customerPoints: CustomerPoint[];
  targetPipeId?: string;
  snapPoints: Position[];
  strategy: "nearest-to-point" | "cursor";
};

export type EphemeralEditingState =
  | EphemeralDrawLink
  | EphemeralDrawNode
  | EphemeralMoveAssets
  | EphemeralCustomerPointsHighlight
  | EphemeralConnectCustomerPoints
  | { type: "none" };

export const ephemeralStateAtom = atom<EphemeralEditingState>({ type: "none" });

export { Mode, MODE_INFO, modeAtom };

export const lastSearchResultAtom = atom<QItemAddable | null>(null);

/**
 * File info
 */
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

/**
 * Time in milliseconds to wait for a sync operation
 * to finish before showing a spinner UI.
 */
const SPINNER_WAIT = 500;

/**
 * A debounced spinner machine. When Replicache is syncing,
 * the SYNC event tells this to show a spinner in SPINNER_WAIT
 * milliseconds. When a sync completes, the UNSYNC command
 * returns to idle state and cancels the timeout if
 * necessary.
 */
const syncingMachine = createMachine({
  schema: {
    context: {} as { elapsed: number },
    events: {} as { type: "SYNC" } | { type: "UNSYNC" },
  },
  predictableActionArguments: true,
  id: "syncingMachine",
  initial: "idle",
  on: {
    UNSYNC: "idle",
  },
  states: {
    idle: {
      on: {
        SYNC: "syncing",
      },
    },
    syncing: {
      after: {
        [SPINNER_WAIT]: {
          target: "spinner",
        },
      },
    },
    spinner: {},
  },
});

export const syncingMachineAtom = atomWithMachine(() => syncingMachine);

export enum TabOption {
  Asset = "Asset",
  Map = "Map",
}

export const tabAtom = atom<TabOption>(TabOption.Asset);

export type VirtualColumns = string[];
export const virtualColumnsAtom = atom<VirtualColumns>([]);

export interface FilterOptions {
  column: string | null;
  search: string | null;
  isCaseSensitive: boolean;
  geometryType: string | null;
  folderId: IFolder["id"] | null;
  exact: boolean;
}

export const initialFilterValues: FilterOptions = {
  column: "",
  search: "",
  isCaseSensitive: false,
  geometryType: null,
  folderId: null,
  exact: false,
};

export const tableFilterAtom = atom<FilterOptions>(initialFilterValues);

export const seenPlayModal = atomWithStorage<boolean>("seenPlayModal", false);

export const circleTypeAtom = atomWithStorage<CIRCLE_TYPE>(
  "circleType",
  CIRCLE_TYPE.MERCATOR,
);

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

export const initialRememberedDefaults = {
  pipe: {},
} as const;

export const rememberedDefaultsAtom = atom<{
  pipe: {
    diameter?: number;
    roughness?: number;
    minorLoss?: number;
    initialStatus?: PipeStatus;
  };
}>(initialRememberedDefaults);
