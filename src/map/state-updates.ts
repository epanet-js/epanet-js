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
  customerPointsMetaAtom,
  currentZoomAtom,
} from "src/state/jotai";
import { MapEngine } from "./map-engine";
import {
  buildIconPointsSource,
  buildOptimizedAssetsSource,
  buildEphemeralStateSource,
} from "./data-source";
import { usePersistence } from "src/lib/persistence/context";
import { ISymbology, LayerConfigMap, SYMBOLIZATION_NONE } from "src/types";
import loadAndAugmentStyle from "src/lib/load-and-augment-style";
import { Asset, AssetId, AssetsMap, filterAssets } from "src/hydraulic-model";
import { MomentLog } from "src/lib/persistence/moment-log";
import { IDMap, UIDMap } from "src/lib/id-mapper";
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
  buildCustomerPointsHighlightOverlay,
  buildCustomerPointsSelectionOverlay,
  buildConnectCustomerPointsPreviewOverlay,
  updateCustomerPointsOverlayVisibility,
} from "./overlays/customer-points";
import {
  CustomerPoint,
  CustomerPoints,
} from "src/hydraulic-model/customer-points";
import { DEFAULT_ZOOM } from "./map-engine";

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
  hiddenCustomerPoints: CustomerPoint[];
  isOffline: boolean;
  customerPointsMeta: { count: number; keysHash: string };
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
  hiddenCustomerPoints: [],
  isOffline: false,
  customerPointsMeta: { count: 0, keysHash: "" },
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
  const customerPointsMeta = get(customerPointsMetaAtom);
  const currentZoom = get(currentZoomAtom);
  const selectedAssetIds = new Set(USelection.toIds(selection));

  const movedAssetIds = getMovedAssets(ephemeralState);
  const hiddenCustomerPoints = getHiddenCustomerPoints(ephemeralState);
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
    hiddenCustomerPoints,
    isOffline,
    customerPointsMeta,
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
  hasNewSimulation: boolean;
  hasNewSymbology: boolean;
  hasNewCustomerPoints: boolean;
  hasNewHiddenCustomerPoints: boolean;
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
    hasNewSimulation: state.simulation !== prev.simulation,
    hasNewSymbology: state.symbology !== prev.symbology,
    hasNewCustomerPoints: state.customerPointsMeta !== prev.customerPointsMeta,
    hasNewHiddenCustomerPoints:
      state.hiddenCustomerPoints !== prev.hiddenCustomerPoints,
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
  const { idMap } = usePersistence();
  const lastHiddenFeatures = useRef<Set<RawId>>(new Set([]));
  const previousMapStateRef = useRef<MapState>(nullMapState);
  const customerPointsOverlayRef = useRef<CustomerPointsOverlay>([]);
  const selectionDeckLayersRef = useRef<CustomerPointsOverlay>([]);
  const ephemeralDeckLayersRef = useRef<CustomerPointsOverlay>([]);
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const isCustomerPointOn = useFeatureFlag("FLAG_CUSTOMER_POINT");

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
      hasNewSymbology,
      hasNewSimulation,
      hasNewCustomerPoints,
      hasNewHiddenCustomerPoints,
      hasNewZoom,
    } = changes;

    const shouldShowLoader =
      hasNewImport ||
      hasNewEditions ||
      hasNewStyles ||
      hasNewSymbology ||
      (hasNewSimulation && mapState.simulation.status !== "running");

    if (shouldShowLoader) {
      setMapLoading(true);
    }

    setTimeout(async () => {
      try {
        if (hasNewStyles) {
          resetMapState(map);
          await updateLayerStyles(map, mapState.stylesConfig, translate);
        }

        if (hasNewSymbology || hasNewStyles) {
          toggleAnalysisLayers(map, mapState.symbology);
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
            idMap,
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
            idMap,
            mapState.symbology,
            quantities,
            translateUnit,
          );
          const newHiddenFeatures = updateImportedSourceVisibility(
            map,
            lastHiddenFeatures.current,
            editedAssetIds,
            idMap,
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
          await updateIconsSource(map, assets, idMap, mapState.selection);
        }

        if (
          isCustomerPointOn &&
          (hasNewImport ||
            hasNewEditions ||
            hasNewStyles ||
            hasNewCustomerPoints ||
            hasNewHiddenCustomerPoints)
        ) {
          customerPointsOverlayRef.current = buildCustomerPointsOverlay(
            hydraulicModel.customerPoints,
            mapState.currentZoom,
            mapState.hiddenCustomerPoints.length > 0
              ? new Set(mapState.hiddenCustomerPoints.map((cp) => cp.id))
              : undefined,
          );
        }

        if ((hasNewZoom || hasNewSelection) && isCustomerPointOn) {
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

        if (hasNewEphemeralState && isCustomerPointOn) {
          ephemeralDeckLayersRef.current = buildCustomerPointsEphemeralOverlay(
            mapState.ephemeralState,
            mapState.currentZoom,
          );
        }

        if (hasNewSelection && isCustomerPointOn) {
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
            idMap,
          );
          await updateEphemeralStateSource(
            map,
            mapState.ephemeralState,
            idMap,
            assets,
          );
        }

        if ((hasNewSelection && !hasNewImport) || hasNewStyles) {
          updateSelection(
            map,
            mapState.selection,
            previousMapState.selection,
            idMap,
          );
        }

        if (isCustomerPointOn) {
          const shouldHideCustomerPointsOverlay =
            mapState.ephemeralState.type === "moveAssets" &&
            mapState.ephemeralState.targetAssets.length > 0;
          const combinedOverlay = [
            ...(shouldHideCustomerPointsOverlay
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
    idMap,
    map,
    momentLog,
    quantities,
    setMapLoading,
    translate,
    translateUnit,
    hydraulicModel,
    isCustomerPointOn,
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

const updateLayerStyles = withDebugInstrumentation(
  async (
    map: MapEngine,
    styles: StylesConfig,
    translate: (key: string) => string,
  ) => {
    const style = await loadAndAugmentStyle({
      ...styles,
      translate,
    });
    await map.setStyle(style);
  },
  { name: "MAP_STATE:UPDATE_STYLES", maxDurationMs: 1000 },
);

const toggleAnalysisLayers = withDebugInstrumentation(
  (map: MapEngine, symbology: SymbologySpec) => {
    if (!symbology.link.colorRule) {
      map.hideLayers(["imported-pipe-arrows", "pipe-arrows"]);
    } else {
      map.showLayers(["imported-pipe-arrows", "pipe-arrows"]);
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
    idMap: IDMap,
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
      idMap,
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
    idMap: IDMap,
    symbology: SymbologySpec,
    quantities: Quantities,
    translateUnit: (unit: Unit) => string,
  ): Promise<Set<AssetId>> => {
    const editionMoments = momentLog.getDeltas();

    const editionAssetIds = getAssetIdsInMoments(editionMoments);
    const editedAssets = filterAssets(assets, editionAssetIds);

    const features = buildOptimizedAssetsSource(
      editedAssets,
      idMap,
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
  async (
    map: MapEngine,
    assets: AssetsMap,
    idMap: IDMap,
    selection: Sel,
  ): Promise<void> => {
    const selectionSet = new Set(USelection.toIds(selection));
    const features = buildIconPointsSource(assets, idMap, selectionSet);
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
    lastHiddenFeatures: Set<RawId>,
    editedAssetIds: Set<AssetId>,
    idMap: IDMap,
  ): Set<RawId> => {
    const newHiddenFeatures = Array.from(editedAssetIds).map((uuid) =>
      UIDMap.getIntID(idMap, uuid),
    );
    const newShownFeatures = Array.from(lastHiddenFeatures).filter(
      (intId) => !editedAssetIds.has(UIDMap.getUUID(idMap, intId)),
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
    featuresHiddenFromImport: Set<RawId>,
    idMap: IDMap,
  ) => {
    for (const assetId of previousMovedAssetIds.values()) {
      const featureId = UIDMap.getIntID(idMap, assetId);
      map.showFeature("features", featureId);
      map.showFeature("icons", featureId);

      if (featuresHiddenFromImport.has(featureId)) continue;

      map.showFeature("imported-features", featureId);
    }

    for (const assetId of movedAssetIds.values()) {
      const featureId = UIDMap.getIntID(idMap, assetId);
      map.hideFeature("features", featureId);
      map.hideFeature("icons", featureId);

      if (featuresHiddenFromImport.has(featureId)) continue;

      map.hideFeature("imported-features", featureId);
    }
  },
  {
    name: "MAP_STATE:UPDATE_EDITIONS_VISIBILITY",
    maxDurationMs: 100,
  },
);

const updateSelection = withDebugInstrumentation(
  (map: MapEngine, selection: Sel, previousSelection: Sel, idMap: IDMap) => {
    const prevSet = new Set(USelection.toIds(previousSelection));
    const newSet = new Set(USelection.toIds(selection));

    for (const assetId of newSet) {
      const featureId = UIDMap.getIntID(idMap, assetId);
      map.selectFeature("features", featureId);
      map.selectFeature("imported-features", featureId);
    }

    for (const assetId of prevSet) {
      if (newSet.has(assetId)) continue;
      const featureId = UIDMap.getIntID(idMap, assetId);

      map.unselectFeature("features", featureId);
      map.unselectFeature("imported-features", featureId);
    }
  },
  { name: "MAP_STATE:UPDATE_SELECTION", maxDurationMs: 100 },
);

const updateEphemeralStateSource = withDebugInstrumentation(
  async (
    map: MapEngine,
    ephemeralState: EphemeralEditingState,
    idMap: IDMap,
    assets: AssetsMap,
  ): Promise<void> => {
    const features = buildEphemeralStateSource(ephemeralState, idMap, assets);
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
      return noMoved;
    case "customerPointsHighlight":
      return noMoved;
    case "connectCustomerPoints":
      return noMoved;
    case "none":
      return noMoved;
  }
};

const noHiddenCustomerPoints: CustomerPoint[] = [];
const getHiddenCustomerPoints = (
  ephemeralState: EphemeralEditingState,
): CustomerPoint[] => {
  switch (ephemeralState.type) {
    case "connectCustomerPoints":
      return ephemeralState.customerPoints;
    case "customerPointsHighlight":
      return noHiddenCustomerPoints;
    case "drawLink":
      return noHiddenCustomerPoints;
    case "moveAssets":
      //all overlay is hidden
      return noHiddenCustomerPoints;
    case "none":
      return noHiddenCustomerPoints;
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
