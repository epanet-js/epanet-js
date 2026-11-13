import { atom } from "jotai";
import type { SetOptional } from "type-fest";
import type { Sel } from "src/selection";
import {
  ILayerConfig,
  ISymbology,
  LayerConfigMap,
  SYMBOLIZATION_NONE,
} from "src/types";
import { DEFAULT_CENTER, DEFAULT_ZOOM } from "@epanet-js/map";
import type { InitialViewport } from "@epanet-js/map";
import { basemaps } from "src/map/basemaps";
import { satelliteLimitedZoom } from "src/map/satellite-resolution";
import { sortAts } from "src/lib/parse-stored";
import {
  MapEditionsTracker,
  nullMapEditionsTracker,
} from "src/map/map-editions-tracker";
import { showGridAtom } from "src/state/map-projection";
import { memoryMetaAtom } from "src/state/map-symbology";
import type { SymbologySpec, NodeSizeConfig } from "src/map/symbology";
import { nullSymbologySpec, defaultNodeSizeConfig } from "src/map/symbology";
import { symbologyAtom, nodeSizeAtom } from "src/state/map-symbology";
import {
  simulationDerivedAtom,
  simulationResultsDerivedAtom,
  customerPointsDerivedAtom,
} from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";
import {
  type EphemeralEditingState,
  ephemeralStateAtom,
  movedAssetIdsAtom,
} from "src/state/drawing";
import {
  type SimulationState,
  initialSimulationState,
  simulationStepAtom,
} from "src/state/simulation";
import { offlineAtom } from "src/state/offline";
import { mapOverlayFeaturesAtom } from "src/state/map-overlay";
import { zoneFeaturesAtom } from "src/state/zone-features";
import { zoneColorAssignmentsAtom } from "src/state/zone-color-assignments";
import { highlightsAtom, type Highlight } from "src/state/highlights";
import { USelection } from "src/selection";
import type { AssetId } from "src/hydraulic-model";
import { type CustomerPoints } from "@epanet-js/hydraulic-model";
import type { PreviewProperty } from "src/state/map-symbology";
import type { ResultsReader } from "@epanet-js/simulation";

export const mapEditionsTrackerAtom = atom<MapEditionsTracker>(
  new MapEditionsTracker(),
);

export const mapLoadingAtom = atom<boolean>(false);

export const mapBackendFallbackAtom = atom<boolean>(false);

export const currentZoomAtom = atom<number>(DEFAULT_ZOOM);

export const mapViewportAtom = atom<InitialViewport>({
  center: DEFAULT_CENTER,
  zoom: DEFAULT_ZOOM,
});

export type BasemapStyle = keyof typeof basemaps;

export type Basemap = {
  style: BasemapStyle;
  visible: boolean;
  labels: boolean;
  opacity: number;
};

export type CustomBasemapConfig = Extract<ILayerConfig, { type: "MAPBOX" }>;

export const BASEMAP_LAYER_ID = "default-basemap";

export const defaultBasemapState: Basemap = {
  style: "monochrome",
  visible: true,
  labels: true,
  opacity: 1,
};

export const basemapAtom = atom<Basemap>(defaultBasemapState);

export const customBasemapAtom = atom<CustomBasemapConfig | null>(null);

export const customLayersAtom = atom<ILayerConfig[]>([]);

const toBasemapLayerConfig = (basemap: Basemap): ILayerConfig => {
  const { thumbnailClass: _thumbnailClass, ...template } =
    basemaps[basemap.style];
  return {
    ...template,
    id: BASEMAP_LAYER_ID,
    at: "a0",
    tms: false,
    opacity: basemap.opacity,
    visibility: basemap.visible,
    labelVisibility: basemap.labels,
  };
};

const basemapStyleNamed = (name: string): BasemapStyle | undefined =>
  (Object.keys(basemaps) as BasemapStyle[]).find(
    (style) => basemaps[style].name === name,
  );

export const basemapLayerConfigAtom = atom<ILayerConfig>((get) =>
  toBasemapLayerConfig(get(basemapAtom)),
);

export const baseLayerConfigAtom = atom<ILayerConfig>(
  (get) => get(customBasemapAtom) ?? get(basemapLayerConfigAtom),
);

export const layerConfigAtom = atom((get): LayerConfigMap => {
  const base = get(baseLayerConfigAtom);
  return new Map([
    ...get(customLayersAtom).map((l) => [l.id, l] as const),
    [base.id, base],
  ]);
});

export const selectBasemapAtom = atom(null, (get, set, style: BasemapStyle) => {
  const customBasemap = get(customBasemapAtom);
  const labels = customBasemap
    ? customBasemap.labelVisibility
    : get(basemapAtom).labels;
  set(customBasemapAtom, null);
  set(basemapAtom, {
    style,
    visible: true,
    labels,
    opacity: basemaps[style].opacity,
  });
});

export const applyLayerConfigChangesAtom = atom(
  null,
  (
    get,
    set,
    {
      putLayerConfigs = [],
      deleteLayerConfigs = [],
    }: {
      putLayerConfigs?: ILayerConfig[];
      deleteLayerConfigs?: ILayerConfig["id"][];
    },
  ) => {
    const customLayers = new Map(get(customLayersAtom).map((l) => [l.id, l]));

    for (const layerId of deleteLayerConfigs) {
      if (get(customBasemapAtom)?.id === layerId) set(customBasemapAtom, null);
      customLayers.delete(layerId);
    }

    for (const layer of putLayerConfigs) {
      if (layer.type === "MAPBOX" && layer.isBasemap) {
        const style = basemapStyleNamed(layer.name);
        if (!style) continue;
        set(basemapAtom, {
          style,
          visible: layer.visibility,
          labels: layer.labelVisibility,
          opacity: layer.opacity,
        });
      } else if (layer.type === "MAPBOX") {
        set(customBasemapAtom, layer);
      } else {
        customLayers.set(layer.id, layer);
      }
    }

    set(customLayersAtom, [...customLayers.values()].sort(sortAts));
  },
);

export const satelliteMaxZoomAtom = atom<number | null>(satelliteLimitedZoom);

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
  editionsTracker: MapEditionsTracker;
  stylesConfig: StylesConfig;
  selection: Sel;
  ephemeralState: EphemeralEditingState;
  symbology: SymbologySpec;
  simulation: SimulationState;
  simulationStep: number | null;
  resultsReader: ResultsReader | null;
  selectedAssetIds: Set<AssetId>;
  movedAssetIds: Set<AssetId>;
  isOffline: boolean;
  customerPoints: CustomerPoints;
  currentZoom: number;
  mapOverlayFeatures: GeoJSON.Feature[];
  zoneFeatures: GeoJSON.Feature[];
  zoneColorAssignments: Record<number, string>;
  highlights: Highlight[];
  nodeSize: NodeSizeConfig;
  satelliteMaxZoom: number | null;
};

export const nullMapState: MapState = {
  editionsTracker: nullMapEditionsTracker,
  stylesConfig: {
    symbology: SYMBOLIZATION_NONE,
    previewProperty: null,
    layerConfigs: new Map(),
  },
  selection: USelection.none(),
  ephemeralState: { type: "none" },
  symbology: nullSymbologySpec,
  simulation: initialSimulationState,
  simulationStep: null,
  resultsReader: null,
  selectedAssetIds: new Set(),
  movedAssetIds: new Set(),
  isOffline: false,
  customerPoints: new Map(),
  currentZoom: DEFAULT_ZOOM,
  mapOverlayFeatures: [],
  zoneFeatures: [],
  zoneColorAssignments: {},
  highlights: [],
  nodeSize: defaultNodeSizeConfig,
  satelliteMaxZoom: satelliteLimitedZoom,
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

export const mapStateDerivedAtom = atom<MapState>((get) => {
  const editionsTracker = get(mapEditionsTrackerAtom);
  const stylesConfig = get(stylesConfigAtom);
  const selection = get(selectionAtom);
  const ephemeralState = get(ephemeralStateAtom);
  const symbology = get(symbologyAtom);
  const simulation = get(simulationDerivedAtom);
  const simulationStep = get(simulationStepAtom);
  const resultsReader = get(simulationResultsDerivedAtom);
  const customerPoints = get(customerPointsDerivedAtom);
  const currentZoom = get(currentZoomAtom);
  const selectedAssetIds = new Set(USelection.getAssetIds(selection));

  const movedAssetIds = get(movedAssetIdsAtom);
  const isOffline = get(offlineAtom);
  const mapOverlayFeatures = get(mapOverlayFeaturesAtom);
  const zoneFeatures = get(zoneFeaturesAtom);
  const zoneColorAssignments = get(zoneColorAssignmentsAtom);
  const highlights = get(highlightsAtom);
  const nodeSize = get(nodeSizeAtom);
  const satelliteMaxZoom = get(satelliteMaxZoomAtom);

  return {
    editionsTracker,
    stylesConfig,
    selection,
    ephemeralState,
    symbology,
    simulation,
    simulationStep,
    resultsReader,
    selectedAssetIds,
    movedAssetIds,
    isOffline,
    customerPoints,
    currentZoom,
    mapOverlayFeatures,
    zoneFeatures,
    zoneColorAssignments,
    highlights,
    nodeSize,
    satelliteMaxZoom,
  };
});
