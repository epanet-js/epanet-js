import { atom } from "jotai";
import type { SetOptional } from "type-fest";
import type { Sel } from "src/selection/types";
import { ISymbology, LayerConfigMap, SYMBOLIZATION_NONE } from "src/types";
import { DEFAULT_ZOOM } from "src/map/map-engine";
import { showGridAtom } from "src/state/map-projection";
import { memoryMetaAtom } from "src/state/map-symbology";
import type { SymbologySpec } from "src/map/symbology";
import { nullSymbologySpec } from "src/map/symbology";
import { symbologyAtom } from "src/state/map-symbology";
import { momentLogAtom } from "src/state/model-changes";
import { selectionAtom } from "src/state/selection";
import {
  type EphemeralEditingState,
  ephemeralStateAtom,
  movedAssetIdsAtom,
} from "src/state/drawing";
import {
  type SimulationState,
  initialSimulationState,
  simulationAtom,
} from "src/state/simulation";
import { customerPointsAtom } from "src/state/hydraulic-model";
import { offlineAtom } from "src/state/offline";
import { USelection } from "src/selection";
import type { AssetId } from "src/hydraulic-model";
import type { CustomerPoints } from "src/hydraulic-model/customer-points";
import type { PreviewProperty } from "src/state/map-symbology";

export type MomentPointer = {
  pointer: number;
  version: number;
};

export const mapSyncMomentAtom = atom<MomentPointer>({
  pointer: -1,
  version: 0,
});

export const mapLoadingAtom = atom<boolean>(false);

export const currentZoomAtom = atom<number>(DEFAULT_ZOOM);

export const layerConfigAtom = atom<LayerConfigMap>(new Map());

export const satelliteModeOnAtom = atom<boolean>((get) => {
  if (get(showGridAtom)) return false;
  const layersConfig = get(layerConfigAtom);
  return [...layersConfig.values()].some((layer) => layer.name === "Satellite");
});

export type CursorValue = React.CSSProperties["cursor"];
export const cursorStyleAtom = atom<CursorValue>("default");

// TODO: make this specific
type MapboxLayer = any;
export type PartialLayer = SetOptional<MapboxLayer, "createdById">;

export type StylesConfig = {
  symbology: ISymbology;
  layerConfigs: LayerConfigMap;
  previewProperty: PreviewProperty;
};

export type MapState = {
  momentLogId: string;
  momentLogPointer: number;
  syncMomentPointer: number;
  syncMomentVersion: number;
  stylesConfig: StylesConfig;
  selection: Sel;
  ephemeralState: EphemeralEditingState;
  symbology: SymbologySpec;
  simulation: SimulationState;
  selectedAssetIds: Set<AssetId>;
  movedAssetIds: Set<AssetId>;
  isOffline: boolean;
  customerPoints: CustomerPoints;
  currentZoom: number;
};

export const nullMapState: MapState = {
  momentLogId: "",
  momentLogPointer: -1,
  syncMomentPointer: -1,
  syncMomentVersion: 0,
  stylesConfig: {
    symbology: SYMBOLIZATION_NONE,
    previewProperty: null,
    layerConfigs: new Map(),
  },
  selection: { type: "none" },
  ephemeralState: { type: "none" },
  symbology: nullSymbologySpec,
  simulation: initialSimulationState,
  selectedAssetIds: new Set(),
  movedAssetIds: new Set(),
  isOffline: false,
  customerPoints: new Map(),
  currentZoom: DEFAULT_ZOOM,
} as const;

export const stylesConfigAtom = atom<StylesConfig>((get) => {
  const isGridOn = get(showGridAtom);
  const layerConfigs = isGridOn ? new Map() : get(layerConfigAtom);
  const { symbology, label } = get(memoryMetaAtom);

  return {
    symbology: symbology || SYMBOLIZATION_NONE,
    previewProperty: label,
    layerConfigs,
  };
});

export const mapStateAtom = atom<MapState>((get) => {
  const momentLog = get(momentLogAtom);
  const mapSyncMoment = get(mapSyncMomentAtom);
  const stylesConfig = get(stylesConfigAtom);
  const selection = get(selectionAtom);
  const ephemeralState = get(ephemeralStateAtom);
  const symbology = get(symbologyAtom);
  const simulation = get(simulationAtom);
  const customerPoints = get(customerPointsAtom);
  const currentZoom = get(currentZoomAtom);
  const selectedAssetIds = new Set(USelection.toIds(selection));

  const movedAssetIds = get(movedAssetIdsAtom);
  const isOffline = get(offlineAtom);

  return {
    momentLogId: momentLog.id,
    momentLogPointer: momentLog.getPointer(),
    syncMomentPointer: mapSyncMoment.pointer,
    syncMomentVersion: mapSyncMoment.version,
    stylesConfig,
    selection,
    ephemeralState,
    symbology,
    simulation,
    selectedAssetIds,
    movedAssetIds,
    isOffline,
    customerPoints,
    currentZoom,
  };
});
