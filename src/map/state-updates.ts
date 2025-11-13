import { atom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useRef } from "react";
import { Unit } from "src/quantity";
import { Moment } from "src/lib/persistence/moment";
import {
  EphemeralEditingState,
  PreviewProperty,
  Sel,
  SimulationState,
  assetsAtom,
  dataAtom,
  ephemeralStateAtom,
  initialSimulationState,
  layerConfigAtom,
  memoryMetaAtom,
  momentLogAtom,
  selectionAtom,
  simulationAtom,
  currentZoomAtom,
  customerPointsAtom,
} from "src/state/jotai";
import { MapEngine } from "./map-engine";
import {
  buildIconPointsSource,
  buildOptimizedAssetsSource,
  buildEphemeralStateSource,
  buildSelectionSource,
} from "./data-source";
import { ISymbology, LayerConfigMap, SYMBOLIZATION_NONE } from "src/types";
import {
  buildBaseStyle,
  makeLayers,
  makeLayersWithActiveTopology,
} from "./build-style";
import { LayerId } from "./layers";
import { Asset, AssetId, AssetsMap, filterAssets } from "src/hydraulic-model";
import { MomentLog } from "src/lib/persistence/moment-log";
import { captureError } from "src/infra/error-tracking";
import { withDebugInstrumentation } from "src/infra/with-instrumentation";
import { USelection } from "src/selection";
import { SymbologySpec, symbologyAtom } from "src/state/symbology";
import { Quantities } from "src/model-metadata/quantities-spec";
import { nullSymbologySpec } from "src/map/symbology";
import { mapLoadingAtom } from "./state";
import { offlineAtom } from "src/state/offline";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import {
  CustomerPointsOverlay,
  buildCustomerPointsOverlay,
  buildCustomerPointsOverlayWithActiveTopology,
  buildCustomerPointsHighlightOverlay,
  buildCustomerPointsSelectionOverlay,
  buildConnectCustomerPointsPreviewOverlay,
  updateCustomerPointsOverlayVisibility,
} from "./overlays/customer-points";
import { CustomerPoints } from "src/hydraulic-model/customer-points";
import { DEFAULT_ZOOM } from "./map-engine";
import { buildIconPointsSourceWithActiveTopology } from "./data-source/icons";

const SELECTION_LAYERS: LayerId[] = [
  "selected-pipes",
  "selected-pump-lines",
  "selected-valve-lines",
  "selected-pipe-arrows",
  "selected-junctions",
  "selected-icons-halo",
  "selected-icons",
];

const getAssetIdsInMoments = (moments: Moment[]): Set<AssetId> => {
  const assetIds = new Set<AssetId>();
  moments.forEach((moment) => {
    moment.deleteAssets.forEach((assetId) => {
      assetIds.add(assetId);
    });
    moment.putAssets.forEach((asset) => assetIds.add(asset.id));
  });
  return assetIds;
};

type StylesConfig = {
  symbology: ISymbology;
  layerConfigs: LayerConfigMap;
  previewProperty: PreviewProperty;
};

type MapState = {
  momentLogId: string;
  momentLogPointer: number;
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

const nullMapState: MapState = {
  momentLogId: "",
  momentLogPointer: -1,
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

const stylesConfigAtom = atom<StylesConfig>((get) => {
  const layerConfigs = get(layerConfigAtom);
  const { symbology, label } = get(memoryMetaAtom);

  return {
    symbology: symbology || SYMBOLIZATION_NONE,
    previewProperty: label,
    layerConfigs,
  };
});

const mapStateAtom = atom<MapState>((get) => {
  const momentLog = get(momentLogAtom);
  const stylesConfig = get(stylesConfigAtom);
  const selection = get(selectionAtom);
  const ephemeralState = get(ephemeralStateAtom);
  const symbology = get(symbologyAtom);
  const simulation = get(simulationAtom);
  const customerPoints = get(customerPointsAtom);
  const currentZoom = get(currentZoomAtom);
  const selectedAssetIds = new Set(USelection.toIds(selection));

  const movedAssetIds = getMovedAssets(ephemeralState);
  const isOffline = get(offlineAtom);

  return {
    momentLogId: momentLog.id,
    momentLogPointer: momentLog.getPointer(),
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

const detectChanges = (
  state: MapState,
  prev: MapState,
): {
  hasNewImport: boolean;
  hasNewEditions: boolean;
  hasNewStyles: boolean;
  hasNewSelection: boolean;
  hasNewEphemeralState: boolean;
  hasEphemeralStateReset: boolean;
  hasNewSimulation: boolean;
  hasNewSymbology: boolean;
  hasNewCustomerPoints: boolean;
  hasNewZoom: boolean;
} => {
  return {
    hasNewImport: state.momentLogId !== prev.momentLogId,
    hasNewEditions: state.momentLogPointer !== prev.momentLogPointer,
    hasNewStyles:
      state.stylesConfig !== prev.stylesConfig ||
      (!state.isOffline && prev.isOffline),
    hasNewSelection: state.selection !== prev.selection,
    hasNewEphemeralState: state.ephemeralState !== prev.ephemeralState,
    hasEphemeralStateReset:
      prev.ephemeralState.type !== "none" &&
      state.ephemeralState.type === "none",
    hasNewSimulation: state.simulation !== prev.simulation,
    hasNewSymbology: state.symbology !== prev.symbology,
    hasNewCustomerPoints: state.customerPoints !== prev.customerPoints,
    hasNewZoom: state.currentZoom !== prev.currentZoom,
  };
};

export const useMapStateUpdates = (map: MapEngine | null) => {
  const momentLog = useAtomValue(momentLogAtom);
  const mapState = useAtomValue(mapStateAtom);
  const setMapLoading = useSetAtom(mapLoadingAtom);

  const assets = useAtomValue(assetsAtom);
  const {
    hydraulicModel,
    modelMetadata: { quantities },
  } = useAtomValue(dataAtom);
  const lastHiddenFeatures = useRef<Set<AssetId>>(new Set([]));
  const previousMapStateRef = useRef<MapState>(nullMapState);
  const customerPointsOverlayRef = useRef<CustomerPointsOverlay>([]);
  const selectionDeckLayersRef = useRef<CustomerPointsOverlay>([]);
  const ephemeralDeckLayersRef = useRef<CustomerPointsOverlay>([]);
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const isActiveTopologyEnabled = useFeatureFlag("FLAG_ACTIVE_TOPOLOGY");

  const doUpdates = useCallback(() => {
    if (!map) return;

    if (mapState === previousMapStateRef.current) return;

    const previousMapState = previousMapStateRef.current;
    previousMapStateRef.current = mapState;

    const changes = detectChanges(mapState, previousMapState);
    const {
      hasNewImport,
      hasNewStyles,
      hasNewEditions,
      hasNewSelection,
      hasNewEphemeralState,
      hasEphemeralStateReset,
      hasNewSymbology,
      hasNewSimulation,
      hasNewCustomerPoints,
      hasNewZoom,
    } = changes;

    const selectionSize = USelection.toIds(mapState.selection).length;
    const hasLargeSelection = selectionSize > 50;

    const shouldShowLoader =
      hasNewImport ||
      hasNewEditions ||
      hasNewStyles ||
      hasNewSymbology ||
      (hasNewSimulation && mapState.simulation.status !== "running") ||
      (hasNewSelection && hasLargeSelection);

    if (shouldShowLoader) {
      setMapLoading(true);
    }

    setTimeout(async () => {
      try {
        if (hasNewStyles) {
          resetMapState(map);
          await buildBaseStyleAndSetOnMap(
            map,
            mapState.stylesConfig,
            translate,
          );
        }

        if (
          hasNewImport ||
          hasNewStyles ||
          hasNewSymbology ||
          (hasNewSimulation && mapState.simulation.status !== "running")
        ) {
          await updateImportSource(
            map,
            momentLog,
            assets,
            mapState.symbology,
            quantities,
            translateUnit,
          );
        }

        if (
          hasNewEditions ||
          hasNewStyles ||
          hasNewSymbology ||
          (hasNewSimulation && mapState.simulation.status !== "running")
        ) {
          const editedAssetIds = await updateEditionsSource(
            map,
            momentLog,
            assets,
            mapState.symbology,
            quantities,
            translateUnit,
          );
          const newHiddenFeatures = updateImportedSourceVisibility(
            map,
            lastHiddenFeatures.current,
            editedAssetIds,
          );

          lastHiddenFeatures.current = newHiddenFeatures;
        }

        if (
          hasNewImport ||
          hasNewEditions ||
          hasNewStyles ||
          hasNewSymbology ||
          hasNewSelection ||
          (hasNewSimulation && mapState.simulation.status !== "running")
        ) {
          if (isActiveTopologyEnabled) {
            await updateIconsSourceWithActiveTopology(
              map,
              assets,
              mapState.selection,
            );
          } else {
            await updateIconsSource(map, assets, mapState.selection);
          }
        }

        if (
          hasNewImport ||
          hasNewEditions ||
          hasNewStyles ||
          hasNewCustomerPoints
        ) {
          if (isActiveTopologyEnabled) {
            customerPointsOverlayRef.current =
              buildCustomerPointsOverlayWithActiveTopology(
                hydraulicModel.customerPoints,
                assets,
                mapState.currentZoom,
              );
          } else {
            customerPointsOverlayRef.current = buildCustomerPointsOverlay(
              hydraulicModel.customerPoints,
              mapState.currentZoom,
            );
          }
        }

        if (
          hasNewZoom ||
          hasNewSelection ||
          hasNewSymbology ||
          hasEphemeralStateReset
        ) {
          customerPointsOverlayRef.current =
            updateCustomerPointsOverlayVisibility(
              customerPointsOverlayRef.current,
              mapState.currentZoom,
            );

          selectionDeckLayersRef.current =
            updateCustomerPointsOverlayVisibility(
              selectionDeckLayersRef.current,
              mapState.currentZoom,
            );

          ephemeralDeckLayersRef.current =
            updateCustomerPointsOverlayVisibility(
              ephemeralDeckLayersRef.current,
              mapState.currentZoom,
            );
        }

        if (hasNewEphemeralState) {
          ephemeralDeckLayersRef.current = buildCustomerPointsEphemeralOverlay(
            mapState.ephemeralState,
            mapState.currentZoom,
          );
        }

        if (hasNewSelection) {
          selectionDeckLayersRef.current =
            buildSelectionOverlayForCustomerPoints(
              mapState.selection,
              hydraulicModel.customerPoints,
              mapState.currentZoom,
            );
        }

        if (hasNewEphemeralState) {
          updateEditionsVisibility(
            map,
            previousMapState.movedAssetIds,
            mapState.movedAssetIds,
            lastHiddenFeatures.current,
          );
          await updateEphemeralStateSource(
            map,
            mapState.ephemeralState,
            assets,
          );
        }

        if (hasNewSelection || hasNewStyles || hasNewEditions) {
          await updateSelection(
            map,
            mapState.selection,
            assets,
            mapState.movedAssetIds,
          );
        }

        if (hasNewStyles) {
          addEditingLayersToMap(
            map,
            mapState.stylesConfig,
            isActiveTopologyEnabled,
          );
          toggleAnalysisLayers(map, mapState.symbology);
        }

        if (hasNewSymbology && !hasNewStyles) {
          toggleAnalysisLayers(map, mapState.symbology);
        }

        if (
          hasNewSymbology ||
          hasNewZoom ||
          hasNewSelection ||
          hasNewEphemeralState ||
          hasNewCustomerPoints ||
          hasNewEditions
        ) {
          const shouldHideCustomerPointsOverlay =
            (mapState.ephemeralState.type === "moveAssets" &&
              mapState.ephemeralState.targetAssets.length > 0) ||
            (mapState.ephemeralState.type === "drawLink" &&
              mapState.ephemeralState.sourceLink);

          const isCustomerPointsVisible =
            mapState.symbology.customerPoints.visible;

          const combinedOverlay = [
            ...(shouldHideCustomerPointsOverlay || !isCustomerPointsVisible
              ? []
              : customerPointsOverlayRef.current),
            ...selectionDeckLayersRef.current,
            ...ephemeralDeckLayersRef.current,
          ];
          map.setOverlay(combinedOverlay);
        }

        setMapLoading(false);
      } catch (error) {
        captureError(error as Error);
        setMapLoading(false);
      }
    }, 0);
  }, [
    mapState,
    assets,
    map,
    momentLog,
    quantities,
    setMapLoading,
    translate,
    translateUnit,
    hydraulicModel,
    isActiveTopologyEnabled,
  ]);

  doUpdates();
};

const resetMapState = withDebugInstrumentation(
  (map: MapEngine) => {
    map.removeSource("features");
    map.removeSource("imported-features");
  },
  { name: "MAP_STATE:RESET_SOURCES", maxDurationMs: 100 },
);

const buildBaseStyleAndSetOnMap = withDebugInstrumentation(
  async (
    map: MapEngine,
    styles: StylesConfig,
    translate: (key: string) => string,
  ) => {
    const style = await buildBaseStyle({
      layerConfigs: styles.layerConfigs,
      translate,
    });
    await map.setStyle(style);
  },
  { name: "MAP_STATE:BUILD_BASE_STYLE", maxDurationMs: 1000 },
);

const toggleAnalysisLayers = withDebugInstrumentation(
  (map: MapEngine, symbology: SymbologySpec) => {
    if (!symbology.link.colorRule) {
      map.hideLayers([
        "imported-pipe-arrows",
        "pipe-arrows",
        "selected-pipe-arrows",
      ]);
    } else {
      map.showLayers([
        "imported-pipe-arrows",
        "pipe-arrows",
        "selected-pipe-arrows",
      ]);
    }
    if (!symbology.node.colorRule) {
      map.hideLayers(["imported-junction-results", "junction-results"]);
    } else {
      map.showLayers(["imported-junction-results", "junction-results"]);
    }
  },
  { name: "MAP_STATE:TOGGLE_ANALYSIS_LAYERS", maxDurationMs: 100 },
);

const updateImportSource = withDebugInstrumentation(
  async (
    map: MapEngine,
    momentLog: MomentLog,
    assets: AssetsMap,
    symbology: SymbologySpec,
    quantities: Quantities,
    translateUnit: (unit: Unit) => string,
  ) => {
    const importSnapshot = momentLog.getSnapshot();
    if (!importSnapshot) {
      await map.setSource("imported-features", []);
      return;
    }

    const importedAssets = new AssetsMap();
    const { moment } = importSnapshot;
    for (const asset of moment.putAssets as Asset[]) {
      importedAssets.set(asset.id, asset);
    }

    const features = buildOptimizedAssetsSource(
      importedAssets,
      symbology,
      quantities,
      translateUnit,
    );
    await map.setSource("imported-features", features);
  },
  {
    name: "MAP_STATE:UPDATE_IMPORT_SOURCE",
    maxDurationMs: 10000,
    maxCalls: 10,
    callsIntervalMs: 1000,
  },
);

const updateEditionsSource = withDebugInstrumentation(
  async (
    map: MapEngine,
    momentLog: MomentLog,
    assets: AssetsMap,
    symbology: SymbologySpec,
    quantities: Quantities,
    translateUnit: (unit: Unit) => string,
  ): Promise<Set<AssetId>> => {
    const editionMoments = momentLog.getDeltas();

    const editionAssetIds = getAssetIdsInMoments(editionMoments);
    const editedAssets = filterAssets(assets, editionAssetIds);

    const features = buildOptimizedAssetsSource(
      editedAssets,
      symbology,
      quantities,
      translateUnit,
    );
    await map.setSource("features", features);

    return editionAssetIds;
  },
  {
    name: "MAP_STATE:UPDATE_EDITIONS_SOURCE",
    maxDurationMs: 250,
  },
);

const updateIconsSource = withDebugInstrumentation(
  async (map: MapEngine, assets: AssetsMap, selection: Sel): Promise<void> => {
    const selectionSet = new Set(USelection.toIds(selection));
    const features = buildIconPointsSource(assets, selectionSet);
    await map.setSource("icons", features);
  },
  {
    name: "MAP_STATE:UPDATE_ICONS_SOURCE",
    maxDurationMs: 250,
  },
);

const updateIconsSourceWithActiveTopology = withDebugInstrumentation(
  async (map: MapEngine, assets: AssetsMap, selection: Sel): Promise<void> => {
    const selectionSet = new Set(USelection.toIds(selection));
    const features = buildIconPointsSourceWithActiveTopology(
      assets,
      selectionSet,
    );
    await map.setSource("icons", features);
  },
  {
    name: "MAP_STATE:UPDATE_ICONS_SOURCE",
    maxDurationMs: 250,
  },
);

const updateImportedSourceVisibility = withDebugInstrumentation(
  (
    map: MapEngine,
    lastHiddenFeatures: Set<AssetId>,
    editedAssetIds: Set<AssetId>,
  ): Set<AssetId> => {
    const newHiddenFeatures = Array.from(editedAssetIds);
    const newShownFeatures = Array.from(lastHiddenFeatures).filter(
      (assetId) => !editedAssetIds.has(assetId),
    );
    map.showFeatures("imported-features", newShownFeatures);
    map.hideFeatures("imported-features", newHiddenFeatures);

    return new Set(newHiddenFeatures);
  },
  { name: "MAP_STATE:UPDATE_VISIBILTIES", maxDurationMs: 100 },
);

const updateEditionsVisibility = withDebugInstrumentation(
  (
    map: MapEngine,
    previousMovedAssetIds: Set<AssetId>,
    movedAssetIds: Set<AssetId>,
    featuresHiddenFromImport: Set<AssetId>,
  ) => {
    for (const assetId of previousMovedAssetIds.values()) {
      map.showFeature("features", assetId);
      map.showFeature("icons", assetId);

      if (featuresHiddenFromImport.has(assetId)) continue;

      map.showFeature("imported-features", assetId);
    }

    for (const assetId of movedAssetIds.values()) {
      map.hideFeature("features", assetId);
      map.hideFeature("icons", assetId);

      if (featuresHiddenFromImport.has(assetId)) continue;

      map.hideFeature("imported-features", assetId);
    }

    if (movedAssetIds.size > 0) {
      map.hideLayers(SELECTION_LAYERS);
    } else if (previousMovedAssetIds.size > 0) {
      map.showLayers(SELECTION_LAYERS);
    }
  },
  {
    name: "MAP_STATE:UPDATE_EDITIONS_VISIBILITY",
    maxDurationMs: 100,
  },
);

const updateSelection = withDebugInstrumentation(
  async (
    map: MapEngine,
    selection: Sel,
    assets: AssetsMap,
    movedAssetIds: Set<AssetId>,
  ): Promise<void> => {
    const features = buildSelectionSource(assets, selection, movedAssetIds);
    await map.setSource("selected-features", features);
  },
  { name: "MAP_STATE:UPDATE_SELECTION", maxDurationMs: 100 },
);

const addEditingLayersToMap = withDebugInstrumentation(
  (
    map: MapEngine,
    stylesConfig: StylesConfig,
    isActiveTopologyEnabled: boolean,
  ) => {
    const layers = isActiveTopologyEnabled
      ? makeLayersWithActiveTopology({
          symbology: stylesConfig.symbology,
          previewProperty: stylesConfig.previewProperty,
        })
      : makeLayers({
          symbology: stylesConfig.symbology,
          previewProperty: stylesConfig.previewProperty,
        });

    for (const layer of layers) {
      map.addLayer(layer);
    }
  },
  { name: "MAP_STATE:ADD_EDITING_LAYERS", maxDurationMs: 100 },
);

const updateEphemeralStateSource = withDebugInstrumentation(
  async (
    map: MapEngine,
    ephemeralState: EphemeralEditingState,
    assets: AssetsMap,
  ): Promise<void> => {
    const features = buildEphemeralStateSource(ephemeralState, assets);
    await map.setSource("ephemeral", features);
  },
  {
    name: "MAP_STATE:UPDATE_EPHEMERAL_STATE_SOURCE",
    maxDurationMs: 100,
  },
);

const noMoved: Set<AssetId> = new Set();
const getMovedAssets = (
  ephemeralState: EphemeralEditingState,
): Set<AssetId> => {
  switch (ephemeralState.type) {
    case "moveAssets":
      return new Set(ephemeralState.oldAssets.map((asset) => asset.id));
    case "drawLink":
      return ephemeralState.sourceLink
        ? new Set([ephemeralState.sourceLink.id])
        : noMoved;
    case "drawNode":
      return noMoved;
    case "customerPointsHighlight":
      return noMoved;
    case "connectCustomerPoints":
      return noMoved;
    case "areaSelect":
      return noMoved;
    case "none":
      return noMoved;
  }
};

const buildCustomerPointsEphemeralOverlay = (
  ephemeralState: EphemeralEditingState,
  zoom: number,
): CustomerPointsOverlay => {
  if (ephemeralState.type === "customerPointsHighlight") {
    return buildCustomerPointsHighlightOverlay(
      ephemeralState.customerPoints,
      zoom,
    );
  } else if (ephemeralState.type === "connectCustomerPoints") {
    return buildConnectCustomerPointsPreviewOverlay(
      ephemeralState.customerPoints,
      ephemeralState.snapPoints,
      zoom,
      "highlight",
    );
  }
  return [];
};

const buildSelectionOverlayForCustomerPoints = (
  selection: Sel,
  customerPoints: CustomerPoints,
  zoom: number,
): CustomerPointsOverlay => {
  if (selection.type === "singleCustomerPoint") {
    const customerPoint = customerPoints.get(selection.id);
    if (customerPoint) {
      return buildCustomerPointsSelectionOverlay([customerPoint], zoom);
    }
  }
  return [];
};
