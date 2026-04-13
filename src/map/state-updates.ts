import type { Sel } from "src/selection/types";
import { useAtomValue, useSetAtom } from "jotai";
import { type MutableRefObject, useCallback, useRef } from "react";
import { Unit } from "src/quantity";
import type { ModelMoment } from "src/hydraulic-model/model-operation";
import { projectSettingsAtom } from "src/state/project-settings";
import type { EphemeralEditingState } from "src/state/drawing";
import { assetsAtom, stagingModelAtom } from "src/state/hydraulic-model";
import {
  assetsDerivedAtom,
  stagingModelDerivedAtom,
  momentLogDerivedAtom,
} from "src/state/derived-branch-state";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import {
  type StylesConfig,
  type MapState,
  nullMapState,
  mapStateAtom,
  mapStateDerivedAtom,
  mapSyncMomentAtom,
  mapLoadingAtom,
} from "src/state/map";
import { gridPreviewAtom, showGridAtom } from "src/state/map-projection";
import { momentLogAtom } from "src/state/model-changes";
import type { ResultsReader } from "src/simulation/results-reader";
import { MapEngine } from "./map-engine";
import {
  buildIconPointsSource,
  buildOptimizedAssetsSource,
  buildEphemeralStateSource,
  buildSelectionSource,
  FeatureSources,
} from "./data-source";
import mapboxgl from "mapbox-gl";
import { Grid } from "./grid";
import { buildBaseStyle, makeLayers } from "./build-style";
import { gisDataAtom } from "src/state/gis-data";
import {
  gisLayerFill,
  gisLayerLine,
  gisLayerCircle,
  gisLayerLabel,
} from "./layers/gis-layer";
import { LayerId } from "./layers";
import { AssetId, AssetsMap, filterAssets } from "src/hydraulic-model";
import { MomentLog } from "src/lib/persistence/moment-log";
import { captureError } from "src/infra/error-tracking";
import { withDebugInstrumentation } from "src/infra/with-instrumentation";
import { USelection } from "src/selection";
import { SymbologySpec } from "src/state/map-symbology";
import type { NodeDefaults, LinkDefaults } from "src/map/symbology";
import {
  FormattingSpec,
  UnitsSpec,
} from "src/lib/project-settings/quantities-spec";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import {
  CustomerPointsOverlay,
  buildCustomerPointsOverlay,
  buildCustomerPointsHighlightOverlay,
  buildCustomerPointsSelectionOverlay,
  buildConnectCustomerPointsPreviewOverlay,
  buildMovingCustomerPointOverlay,
  updateCustomerPointsOverlayVisibility,
} from "./overlays/customer-points";
import { CustomerPoints } from "src/hydraulic-model/customer-points";
import {
  junctionsSymbologyFilterExpression,
  junctionFillColorExpression,
  junctionStrokeColorExpression,
} from "./layers/junctions";
import {
  pipeLinkColorExpression,
  pipeArrowColorExpression,
} from "./layers/pipes";

const SELECTION_LAYERS: LayerId[] = [
  "selected-pipes",
  "selected-pump-lines",
  "selected-valve-lines",
  "selected-junctions",
  "selected-icons-halo",
  "selected-icons",
];

const getAssetIdsInMoments = (moments: ModelMoment[]): Set<AssetId> => {
  const assetIds = new Set<AssetId>();
  moments.forEach((moment) => {
    (moment.deleteAssets || []).forEach((assetId) => {
      assetIds.add(assetId);
    });
    (moment.putAssets || []).forEach((asset) => assetIds.add(asset.id));
    (moment.patchAssetsAttributes || []).forEach((patch) =>
      assetIds.add(patch.id),
    );
  });
  return assetIds;
};

const detectChanges = (
  state: MapState,
  prev: MapState,
  map: MapEngine,
): {
  hasNewImport: boolean;
  hasNewEditions: boolean;
  hasNewStyles: boolean;
  hasNewSelection: boolean;
  hasNewEphemeralState: boolean;
  hasEphemeralStateReset: boolean;
  hasNewSimulation: boolean;
  hasNewSymbologyRules: boolean;
  hasNewCustomerPointsSymbology: boolean;
  hasNewDefaultColors: boolean;
  hasNewCustomerPoints: boolean;
  hasNewZoom: boolean;
  hasSyncMomentChanged: boolean;
  hasNewResults: boolean;
  hasNewMapOverlay: boolean;
} => {
  return {
    hasNewImport: state.momentLogId !== prev.momentLogId,
    hasNewEditions: state.momentLogPointer !== prev.momentLogPointer,
    hasNewStyles:
      !map.isStyleLoaded() ||
      state.stylesConfig !== prev.stylesConfig ||
      (!state.isOffline && prev.isOffline),
    hasNewSelection: state.selection !== prev.selection,
    hasNewEphemeralState: state.ephemeralState !== prev.ephemeralState,
    hasEphemeralStateReset:
      prev.ephemeralState.type !== "none" &&
      state.ephemeralState.type === "none",
    hasNewSimulation:
      state.simulation !== prev.simulation ||
      state.simulationStep !== prev.simulationStep,
    hasNewSymbologyRules:
      state.symbology.node.colorRule !== prev.symbology.node.colorRule ||
      state.symbology.node.labelRule !== prev.symbology.node.labelRule ||
      state.symbology.link.colorRule !== prev.symbology.link.colorRule ||
      state.symbology.link.labelRule !== prev.symbology.link.labelRule,
    hasNewCustomerPointsSymbology:
      state.symbology.customerPoints !== prev.symbology.customerPoints,
    hasNewDefaultColors:
      state.symbology.node.defaults !== prev.symbology.node.defaults ||
      state.symbology.link.defaults !== prev.symbology.link.defaults,
    hasNewCustomerPoints: state.customerPoints !== prev.customerPoints,
    hasNewZoom: state.currentZoom !== prev.currentZoom,
    hasSyncMomentChanged: state.syncMomentVersion !== prev.syncMomentVersion,
    hasNewResults: state.resultsReader !== prev.resultsReader,
    hasNewMapOverlay: state.mapOverlayFeatures !== prev.mapOverlayFeatures,
  };
};

export const useMapStateUpdates = (map: MapEngine | null) => {
  const isStateRefactorOn = useFeatureFlag("FLAG_STATE_REFACTOR");
  const momentLog = useAtomValue(
    isStateRefactorOn ? momentLogDerivedAtom : momentLogAtom,
  );
  const setMapSyncMoment = useSetAtom(mapSyncMomentAtom);
  const mapState = useAtomValue(
    isStateRefactorOn ? mapStateDerivedAtom : mapStateAtom,
  );
  const setMapLoading = useSetAtom(mapLoadingAtom);

  const assets = useAtomValue(
    isStateRefactorOn ? assetsDerivedAtom : assetsAtom,
  );
  const hydraulicModel = useAtomValue(
    isStateRefactorOn ? stagingModelDerivedAtom : stagingModelAtom,
  );
  const { units, formatting } = useAtomValue(projectSettingsAtom);
  const gisData = useAtomValue(gisDataAtom);
  const isGridOn = useAtomValue(showGridAtom);
  const isGridPreview = useAtomValue(gridPreviewAtom);
  const lastHiddenFeatures = useRef<Set<AssetId>>(new Set([]));
  const previousMapStateRef = useRef<MapState>(nullMapState);
  const customerPointsOverlayRef = useRef<CustomerPointsOverlay>([]);
  const selectionDeckLayersRef = useRef<CustomerPointsOverlay>([]);
  const ephemeralDeckLayersRef = useRef<CustomerPointsOverlay>([]);
  const gridRef = useRef<Grid | null>(null);
  const scaleControlRef = useRef<mapboxgl.ScaleControl | null>(null);
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();

  const doUpdates = useCallback(() => {
    if (!map) return;

    if (mapState === previousMapStateRef.current) return;

    const previousMapState = previousMapStateRef.current;
    previousMapStateRef.current = mapState;

    const changes = detectChanges(mapState, previousMapState, map);
    const {
      hasNewImport,
      hasNewStyles,
      hasNewEditions,
      hasNewSelection,
      hasNewEphemeralState,
      hasEphemeralStateReset,
      hasNewSymbologyRules,
      hasNewCustomerPointsSymbology,
      hasNewDefaultColors,
      hasNewSimulation,
      hasNewCustomerPoints,
      hasNewZoom,
      hasSyncMomentChanged,
      hasNewResults,
      hasNewMapOverlay,
    } = changes;

    const selectionSize = USelection.toIds(mapState.selection).length;
    const hasLargeSelection = selectionSize > 50;

    const shouldShowLoader =
      hasNewImport ||
      hasNewEditions ||
      hasNewStyles ||
      hasNewSymbologyRules ||
      (hasNewSimulation && mapState.simulation.status !== "running") ||
      hasNewResults ||
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
          addEditingLayersToMap(
            map,
            mapState.stylesConfig,
            mapState.symbology.node.defaults,
            mapState.symbology.link.defaults,
          );
          addGisLayersToMap(map, mapState.stylesConfig, gisData);
          toggleAnalysisLayers(map, mapState.symbology);
        }

        if (hasNewDefaultColors && !hasNewStyles) {
          updateDefaultMapColors(
            map,
            mapState.symbology.node.defaults.color,
            mapState.symbology.link.defaults.color,
          );
        }

        if (
          hasSyncMomentChanged ||
          hasNewImport ||
          hasNewStyles ||
          hasNewSymbologyRules ||
          (hasNewSimulation && mapState.simulation.status !== "running") ||
          hasNewResults
        ) {
          await rebuildSources(
            map,
            assets,
            mapState.symbology,
            units,
            formatting,
            translateUnit,
            mapState.resultsReader,
          );
          lastHiddenFeatures.current = new Set();
          setMapSyncMoment((prev) => {
            return { pointer: momentLog.getPointer(), version: prev.version };
          });
        }

        if (hasNewImport || hasNewStyles) {
          updateGrid({
            map,
            isGridOn,
            isPreview: isGridPreview,
            lengthUnit: units.length === "ft" ? "ft" : "m",
            gridRef,
            scaleControlRef,
          });
        }

        if (hasNewEditions && !hasSyncMomentChanged) {
          const { editedAssetIds } = await syncSourcesWithEdits(
            map,
            momentLog,
            mapState.syncMomentPointer,
            assets,
            mapState.symbology,
            units,
            formatting,
            translateUnit,
            mapState.resultsReader,
          );
          lastHiddenFeatures.current = editedAssetIds;
        }

        if (
          hasNewImport ||
          hasNewEditions ||
          hasNewStyles ||
          hasNewSymbologyRules ||
          hasNewSelection ||
          (hasNewSimulation && mapState.simulation.status !== "running") ||
          hasNewResults
        ) {
          await updateIconsSource(
            map,
            assets,
            mapState.selection,
            mapState.resultsReader,
          );
        }

        const movingCustomerPointId =
          mapState.ephemeralState.type === "moveCustomerPoint"
            ? mapState.ephemeralState.customerPoint.id
            : null;
        const prevMovingCustomerPointId =
          previousMapState.ephemeralState.type === "moveCustomerPoint"
            ? previousMapState.ephemeralState.customerPoint.id
            : null;
        const customerPointExclusionChanged =
          movingCustomerPointId !== prevMovingCustomerPointId;

        if (
          hasNewImport ||
          hasNewEditions ||
          hasNewStyles ||
          hasNewCustomerPoints ||
          customerPointExclusionChanged
        ) {
          const excludedCustomerPointIds = movingCustomerPointId
            ? new Set([movingCustomerPointId])
            : undefined;

          customerPointsOverlayRef.current = buildCustomerPointsOverlay(
            hydraulicModel.customerPoints,
            assets,
            mapState.currentZoom,
            excludedCustomerPointIds,
          );
        }

        if (
          hasNewZoom ||
          hasNewSelection ||
          hasNewSymbologyRules ||
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

        if (hasNewSelection || hasNewCustomerPoints) {
          selectionDeckLayersRef.current =
            buildSelectionOverlayForCustomerPoints(
              mapState.selection,
              hydraulicModel.assets,
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

        if (hasNewMapOverlay) {
          await updateMapOverlaySource(map, mapState.mapOverlayFeatures);
        }

        if (
          hasNewSelection ||
          hasNewStyles ||
          hasNewEditions ||
          (hasNewSimulation && mapState.simulation.status !== "running") ||
          hasNewResults
        ) {
          await updateSelection(
            map,
            mapState.selection,
            assets,
            units,
            mapState.movedAssetIds,
            mapState.resultsReader,
          );

          await hideSymbologyForSelectedJunctions(
            map,
            mapState.selection,
            assets,
          );
        }

        if (
          (hasNewSymbologyRules && !hasNewStyles) ||
          hasNewSelection ||
          hasNewEditions
        ) {
          toggleAnalysisLayers(map, mapState.symbology);
        }

        if (
          hasNewCustomerPointsSymbology ||
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

          const shouldHideSelectionDuringMove =
            mapState.ephemeralState.type === "moveCustomerPoint" &&
            mapState.ephemeralState.moveActivated;

          const shouldHideCustomerPointSelection =
            !isCustomerPointsVisible &&
            mapState.selection.type === "singleCustomerPoint";

          const combinedOverlay = [
            ...(shouldHideCustomerPointsOverlay || !isCustomerPointsVisible
              ? []
              : customerPointsOverlayRef.current),
            ...(shouldHideSelectionDuringMove ||
            shouldHideCustomerPointSelection
              ? []
              : selectionDeckLayersRef.current),
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
    setMapSyncMoment,
    units,
    formatting,
    setMapLoading,
    translate,
    gisData,
    translateUnit,
    hydraulicModel,
    isGridOn,
    isGridPreview,
  ]);

  doUpdates();
};

const resetMapState = withDebugInstrumentation(
  (map: MapEngine) => {
    map.removeSource("delta-features");
    map.removeSource("main-features");
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
    const arrowProperties = ["flow", "velocity", "unitHeadloss"];
    const showArrows =
      symbology.link.colorRule &&
      arrowProperties.includes(symbology.link.colorRule.property);
    if (!showArrows) {
      map.hideLayers([
        "main-features-pipe-arrows",
        "delta-features-pipe-arrows",
        "selected-pipe-arrows",
      ]);
    } else {
      map.showLayers([
        "main-features-pipe-arrows",
        "delta-features-pipe-arrows",
        "selected-pipe-arrows",
      ]);
    }
    if (!symbology.node.colorRule) {
      map.hideLayers([
        "main-features-junction-results",
        "delta-features-junction-results",
      ]);
    } else {
      map.showLayers([
        "main-features-junction-results",
        "delta-features-junction-results",
      ]);
    }
  },
  { name: "MAP_STATE:TOGGLE_ANALYSIS_LAYERS", maxDurationMs: 100 },
);

const updateIconsSource = withDebugInstrumentation(
  async (
    map: MapEngine,
    assets: AssetsMap,
    selection: Sel,
    simulationResults?: ResultsReader | null,
  ): Promise<void> => {
    const selectionSet = new Set(USelection.toIds(selection));
    const features = buildIconPointsSource(
      assets,
      selectionSet,
      simulationResults,
    );
    await map.setSource("icons", features);
  },
  {
    name: "MAP_STATE:UPDATE_ICONS_SOURCE",
    maxDurationMs: 250,
  },
);

const updateMainSourceVisibility = withDebugInstrumentation(
  (map: MapEngine, editedAssetIds: Set<AssetId>): void => {
    map.clearFeatureState(FeatureSources.MAIN);

    for (const assetId of editedAssetIds) {
      map.hideFeature(FeatureSources.MAIN, assetId);
    }
  },
  { name: "MAP_STATE:UPDATE_VISIBILITIES", maxDurationMs: 100 },
);

const rebuildSources = withDebugInstrumentation(
  async (
    map: MapEngine,
    assets: AssetsMap,
    symbology: SymbologySpec,
    units: UnitsSpec,
    formatting: FormattingSpec,
    translateUnit: (unit: Unit) => string,
    simulationResults?: ResultsReader | null,
  ): Promise<void> => {
    const features = buildOptimizedAssetsSource(
      assets,
      symbology,
      units,
      formatting,
      translateUnit,
      simulationResults,
    );
    await map.setSource(FeatureSources.MAIN, features);
    await map.setSource(FeatureSources.DELTA, []);

    map.clearFeatureState(FeatureSources.MAIN);
  },
  { name: "MAP_STATE:UPDATE_MAIN_SOURCE", maxDurationMs: 10000 },
);

const updateDeltaSource = withDebugInstrumentation(
  async (
    map: MapEngine,
    assets: AssetsMap,
    editedAssetIds: Set<AssetId>,
    symbology: SymbologySpec,
    units: UnitsSpec,
    formatting: FormattingSpec,
    translateUnit: (unit: Unit) => string,
    simulationResults?: ResultsReader | null,
  ): Promise<void> => {
    const editedAssets = filterAssets(assets, editedAssetIds);
    const features = buildOptimizedAssetsSource(
      editedAssets,
      symbology,
      units,
      formatting,
      translateUnit,
      simulationResults,
    );
    await map.setSource(FeatureSources.DELTA, features);
  },
  { name: "MAP_STATE:UPDATE_DELTA_SOURCE", maxDurationMs: 250 },
);

const syncSourcesWithEdits = async (
  map: MapEngine,
  momentLog: MomentLog,
  mapSyncMoment: number,
  assets: AssetsMap,
  symbology: SymbologySpec,
  units: UnitsSpec,
  formatting: FormattingSpec,
  translateUnit: (unit: Unit) => string,
  simulationResults?: ResultsReader | null,
): Promise<{ editedAssetIds: Set<AssetId> }> => {
  const editedSinceConsolidation = getAssetIdsInMoments(
    momentLog.getDeltas(mapSyncMoment),
  );

  await updateDeltaSource(
    map,
    assets,
    editedSinceConsolidation,
    symbology,
    units,
    formatting,
    translateUnit,
    simulationResults,
  );

  updateMainSourceVisibility(map, editedSinceConsolidation);

  return {
    editedAssetIds: editedSinceConsolidation,
  };
};

const updateEditionsVisibility = withDebugInstrumentation(
  (
    map: MapEngine,
    previousMovedAssetIds: Set<AssetId>,
    movedAssetIds: Set<AssetId>,
    featuresHiddenFromImport: Set<AssetId>,
  ) => {
    for (const assetId of previousMovedAssetIds.values()) {
      map.showFeature("delta-features", assetId);
      map.showFeature("icons", assetId);

      if (featuresHiddenFromImport.has(assetId)) continue;

      map.showFeature("main-features", assetId);
    }

    for (const assetId of movedAssetIds.values()) {
      map.hideFeature("delta-features", assetId);
      map.hideFeature("icons", assetId);

      if (featuresHiddenFromImport.has(assetId)) continue;

      map.hideFeature("main-features", assetId);
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
    units: UnitsSpec,
    movedAssetIds: Set<AssetId>,
    simulationResults?: ResultsReader | null,
  ): Promise<void> => {
    const features = buildSelectionSource(
      assets,
      selection,
      units,
      movedAssetIds,
      simulationResults,
    );

    await map.setSource("selected-features", features);
  },
  { name: "MAP_STATE:UPDATE_SELECTION", maxDurationMs: 100 },
);

const hideSymbologyForSelectedJunctions = withDebugInstrumentation(
  async (map: MapEngine, selection: Sel, assets: AssetsMap): Promise<void> => {
    const selectedIds = USelection.toIds(selection);

    const selectedJunctionIds: AssetId[] = [];

    selectedIds.forEach((selectedAssetId) => {
      const asset = assets.get(selectedAssetId);
      if (!!asset && asset.type === "junction") {
        selectedJunctionIds.push(selectedAssetId);
      }
    });

    const filter = junctionsSymbologyFilterExpression(selectedJunctionIds);

    await map.waitForMapIdle(() => {
      map.setLayerFilter("main-features-junction-results", filter);
      map.setLayerFilter("delta-features-junction-results", filter);
    }, selectedJunctionIds.length);
  },
  { name: "MAP_STATE:UPDATE_JUNCTIONS_SELECTION", maxDurationMs: 100 },
);

function addGisLayersToMap(
  map: MapEngine,
  stylesConfig: StylesConfig,
  gisData: Map<string, import("geojson").FeatureCollection>,
) {
  const orderedLayers = [...stylesConfig.layerConfigs.values()].reverse();
  for (const layerConfig of orderedLayers) {
    if (layerConfig.type !== "GEOJSON") continue;
    const layerId = layerConfig.id;
    const data = gisData.get(layerId);
    if (!data) continue;

    const sourceId = `gis-${layerId}`;
    map.map.addSource(sourceId, { type: "geojson", data });

    map.addLayer(
      gisLayerFill(
        sourceId,
        layerConfig.color,
        layerConfig.opacity,
        layerConfig.visibility,
      ),
    );
    map.addLayer(
      gisLayerLine(
        sourceId,
        layerConfig.color,
        layerConfig.lineWidth,
        layerConfig.opacity,
        layerConfig.visibility,
      ),
    );
    map.addLayer(
      gisLayerCircle(
        sourceId,
        layerConfig.color,
        layerConfig.opacity,
        layerConfig.visibility,
      ),
    );
    map.addLayer(
      gisLayerLabel(
        sourceId,
        layerConfig.color,
        layerConfig.opacity,
        layerConfig.labelVisibility,
      ),
    );
  }
}

const addEditingLayersToMap = withDebugInstrumentation(
  (
    map: MapEngine,
    stylesConfig: StylesConfig,
    nodeDefaults: NodeDefaults,
    linkDefaults: LinkDefaults,
  ) => {
    const layers = makeLayers({
      symbology: stylesConfig.symbology,
      previewProperty: stylesConfig.previewProperty,
      nodeDefaults,
      linkDefaults,
    });

    for (const layer of layers) {
      map.addLayer(layer);
    }
  },
  { name: "MAP_STATE:ADD_EDITING_LAYERS", maxDurationMs: 100 },
);

const updateDefaultMapColors = withDebugInstrumentation(
  (map: MapEngine, nodeColor: string, linkColor: string) => {
    const junctionLayers = [
      "main-features-junctions",
      "delta-features-junctions",
      "main-features-junction-results",
      "delta-features-junction-results",
    ];
    for (const layerId of junctionLayers) {
      map.setLayerPaintRule(
        layerId,
        "circle-color",
        junctionFillColorExpression(nodeColor),
      );
      map.setLayerPaintRule(
        layerId,
        "circle-stroke-color",
        junctionStrokeColorExpression(nodeColor),
      );
    }

    const pipeLayers = ["main-features-pipes", "delta-features-pipes"];
    for (const layerId of pipeLayers) {
      map.setLayerPaintRule(
        layerId,
        "line-color",
        pipeLinkColorExpression(linkColor),
      );
    }

    const arrowLayers = [
      "main-features-pipe-arrows",
      "delta-features-pipe-arrows",
    ];
    for (const layerId of arrowLayers) {
      map.setLayerPaintRule(
        layerId,
        "icon-color",
        pipeArrowColorExpression(linkColor),
      );
    }
  },
  { name: "MAP_STATE:UPDATE_DEFAULT_MAP_COLORS", maxDurationMs: 100 },
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

const updateMapOverlaySource = async (
  map: MapEngine,
  features: GeoJSON.Feature[],
): Promise<void> => {
  await map.setSource(
    "map-overlay",
    features as unknown as import("src/types").Feature[],
  );
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
  } else if (ephemeralState.type === "moveCustomerPoint") {
    return buildMovingCustomerPointOverlay(ephemeralState, zoom);
  }
  return [];
};

const buildSelectionOverlayForCustomerPoints = (
  selection: Sel,
  assets: AssetsMap,
  customerPoints: CustomerPoints,
  zoom: number,
): CustomerPointsOverlay => {
  if (selection.type === "singleCustomerPoint") {
    const customerPoint = customerPoints.get(selection.id);
    const pipeId = customerPoint?.connection?.pipeId;
    let isActive = false;
    if (pipeId) {
      const pipe = assets.get(pipeId);
      if (pipe?.isActive) isActive = true;
    }
    if (customerPoint) {
      return buildCustomerPointsSelectionOverlay(
        [customerPoint],
        isActive,
        zoom,
      );
    }
  }
  return [];
};

function updateGrid({
  map,
  isGridOn,
  isPreview,
  lengthUnit,
  gridRef,
  scaleControlRef,
}: {
  map: MapEngine;
  isGridOn: boolean;
  isPreview: boolean;
  lengthUnit: "ft" | "m";
  gridRef: MutableRefObject<Grid | null>;
  scaleControlRef: MutableRefObject<mapboxgl.ScaleControl | null>;
}) {
  if (isGridOn && !gridRef.current) {
    gridRef.current = new Grid(map.map, lengthUnit);
    gridRef.current.attach();
  } else if (isGridOn && gridRef.current) {
    gridRef.current.setLengthUnit(lengthUnit);
    gridRef.current.forceUpdate();
  } else if (!isGridOn && gridRef.current) {
    gridRef.current.detach();
    gridRef.current = null;
  }
  if (isGridOn && !isPreview) {
    const scaleUnit = lengthUnit === "ft" ? "imperial" : "metric";
    if (scaleControlRef.current) {
      map.map.removeControl(scaleControlRef.current);
    }
    scaleControlRef.current = new mapboxgl.ScaleControl({
      unit: scaleUnit,
    });
    map.map.addControl(scaleControlRef.current, "bottom-left");
  } else if (scaleControlRef.current) {
    map.map.removeControl(scaleControlRef.current);
    scaleControlRef.current = null;
  }
}
