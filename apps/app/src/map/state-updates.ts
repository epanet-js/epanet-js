import type { Sel } from "src/selection";
import { useAtomValue, useSetAtom } from "jotai";
import { type MutableRefObject, useCallback, useRef } from "react";
import { Unit } from "@epanet-js/quantity";
import type { ModelMoment } from "src/hydraulic-model/model-operation";
import { projectSettingsAtom } from "src/state/project-settings";
import type { EphemeralEditingState } from "src/state/drawing";
import {
  assetsDerivedAtom,
  stagingModelDerivedAtom,
  momentLogDerivedAtom,
} from "src/state/derived-branch-state";
import {
  type StylesConfig,
  type MapState,
  nullMapState,
  mapStateDerivedAtom,
  mapSyncMomentAtom,
  mapLoadingAtom,
} from "src/state/map";
import {
  appendSourceRebuildDurationAtom,
  lastHiddenAt,
} from "src/state/performance";
import { gridPreviewAtom, showGridAtom } from "src/state/map-projection";
import type { ResultsReader } from "src/simulation/results-reader";
import { MapEngine } from "./map-engine";
import {
  buildIconPointsSource,
  buildOptimizedAssetsSource,
  buildEphemeralStateSource,
  buildHighlightsSource,
  buildSelectionSource,
  FeatureSources,
} from "./data-source";
import type { Highlight } from "src/state/highlights";
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
import type {
  NodeDefaults,
  LinkDefaults,
  ZoneSymbology,
  NodeSizeConfig,
} from "src/map/symbology";
import { buildZoneColorExpression } from "src/map/layers/zones";
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
import { CustomerPoints } from "@epanet-js/hydraulic-model";
import {
  junctionFillColorExpression,
  junctionStrokeColorExpression,
  junctionCircleRadius,
  junctionLayerMinZoom,
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
  hasNewAssetsSelection: boolean;
  hasNewCustomerPointsSelection: boolean;
  hasNewEphemeralState: boolean;
  hasEphemeralStateReset: boolean;
  hasNewSimulation: boolean;
  hasNewSymbologyRules: boolean;
  hasNewCustomerPointsSymbology: boolean;
  hasNewDefaultColors: boolean;
  hasNewZoneSymbology: boolean;
  hasNewZoneFeatures: boolean;
  hasNewZoneColorAssignments: boolean;
  hasNewCustomerPoints: boolean;
  hasNewZoom: boolean;
  hasSyncMomentChanged: boolean;
  hasNewResults: boolean;
  hasNewMapOverlay: boolean;
  hasNewHighlights: boolean;
  hasNewNodeSize: boolean;
} => {
  return {
    hasNewImport: state.momentLogId !== prev.momentLogId,
    hasNewEditions: state.momentLogPointer !== prev.momentLogPointer,
    hasNewStyles:
      !map.isStyleLoaded() ||
      state.stylesConfig !== prev.stylesConfig ||
      (!state.isOffline && prev.isOffline),
    hasNewAssetsSelection:
      USelection.getAssetIds(state.selection) !==
      USelection.getAssetIds(prev.selection),
    hasNewCustomerPointsSelection:
      USelection.getCustomerPointIds(state.selection) !==
      USelection.getCustomerPointIds(prev.selection),
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
    hasNewZoneSymbology: state.symbology.zone !== prev.symbology.zone,
    hasNewCustomerPoints: state.customerPoints !== prev.customerPoints,
    hasNewZoom: state.currentZoom !== prev.currentZoom,
    hasSyncMomentChanged: state.syncMomentVersion !== prev.syncMomentVersion,
    hasNewResults: state.resultsReader !== prev.resultsReader,
    hasNewMapOverlay: state.mapOverlayFeatures !== prev.mapOverlayFeatures,
    hasNewZoneFeatures: state.zoneFeatures !== prev.zoneFeatures,
    hasNewZoneColorAssignments:
      state.zoneColorAssignments !== prev.zoneColorAssignments,
    hasNewHighlights: state.highlights !== prev.highlights,
    hasNewNodeSize: state.nodeSize !== prev.nodeSize,
  };
};

export const useMapStateUpdates = (map: MapEngine | null) => {
  const momentLog = useAtomValue(momentLogDerivedAtom);
  const setMapSyncMoment = useSetAtom(mapSyncMomentAtom);
  const mapState = useAtomValue(mapStateDerivedAtom);
  const setMapLoading = useSetAtom(mapLoadingAtom);
  const appendSourceRebuildDuration = useSetAtom(
    appendSourceRebuildDurationAtom,
  );
  const assets = useAtomValue(assetsDerivedAtom);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
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
      hasNewAssetsSelection,
      hasNewCustomerPointsSelection,
      hasNewEphemeralState,
      hasEphemeralStateReset,
      hasNewSymbologyRules,
      hasNewCustomerPointsSymbology,
      hasNewDefaultColors,
      hasNewZoneSymbology,
      hasNewZoneFeatures,
      hasNewZoneColorAssignments,
      hasNewSimulation,
      hasNewCustomerPoints,
      hasNewZoom,
      hasSyncMomentChanged,
      hasNewResults,
      hasNewMapOverlay,
      hasNewHighlights,
      hasNewNodeSize,
    } = changes;

    const { assets: selectedAssetsCount, customerPoints: selectedCPcount } =
      USelection.countByKind(mapState.selection);
    const selectionSize = selectedAssetsCount + selectedCPcount;
    const hasLargeSelection = selectionSize > 50;
    const hasNewSelection =
      hasNewAssetsSelection || hasNewCustomerPointsSelection;

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
        const resultsUpdateStartedAt =
          (hasNewResults || hasNewSymbologyRules) && !document.hidden
            ? performance.now()
            : null;

        if (hasNewStyles) {
          map.suspendOverlayStyleReactions();
          resetMapState(map);
          await buildBaseStyleAndSetOnMap(
            map,
            mapState.stylesConfig,
            translate,
          );
          addGisLayersToMap(map, mapState.stylesConfig, gisData);
          addEditingLayersToMap(
            map,
            mapState.stylesConfig,
            mapState.symbology.node.defaults,
            mapState.symbology.link.defaults,
          );
          await map.addIcons();
          map.resumeOverlayStyleReactions();
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
          hasNewZoneSymbology ||
          hasNewZoneFeatures ||
          hasNewZoneColorAssignments ||
          hasNewStyles
        ) {
          updateZoneColors(
            map,
            mapState.symbology.zone,
            mapState.zoneColorAssignments,
          );
          toggleZoneLayers(map, mapState.symbology.zone);
        }

        if (hasNewStyles || hasNewNodeSize || hasNewImport) {
          applyJunctionSize(map, mapState.nodeSize);
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
          hasNewAssetsSelection ||
          (hasNewSimulation && mapState.simulation.status !== "running") ||
          hasNewResults
        ) {
          await updateIconsSource(
            map,
            assets,
            mapState.selection,
            mapState.resultsReader,
          );

          if (resultsUpdateStartedAt !== null) {
            const duration = performance.now() - resultsUpdateStartedAt;
            const hiddenDuring =
              lastHiddenAt !== null && lastHiddenAt > resultsUpdateStartedAt;
            if (!document.hidden && !hiddenDuring) {
              appendSourceRebuildDuration(duration);
            }
          }
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
          hasNewCustomerPointsSelection ||
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

        if (hasNewCustomerPointsSelection || hasNewCustomerPoints) {
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

        if (hasNewZoneFeatures || hasNewStyles) {
          await updateZonesSource(map, mapState.zoneFeatures);
        }

        const hasAssetHighlights = mapState.highlights.some(
          (h) => h.type === "asset",
        );
        if (hasNewHighlights || (hasAssetHighlights && hasNewEditions)) {
          await updateHighlightsSource(map, mapState.highlights, assets);
        }

        if (
          hasNewAssetsSelection ||
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
        }

        if (
          (hasNewSymbologyRules && !hasNewStyles) ||
          hasNewAssetsSelection ||
          hasNewEditions
        ) {
          toggleAnalysisLayers(map, mapState.symbology);
        }

        if (
          hasNewStyles ||
          hasNewCustomerPointsSymbology ||
          hasNewZoom ||
          hasNewCustomerPointsSelection ||
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
            USelection.isSingleCustomerPoint(mapState.selection);

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
    appendSourceRebuildDuration,
    translate,
    gisData,
    translateUnit,
    hydraulicModel.customerPoints,
    hydraulicModel.assets,
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

const applyJunctionSize = withDebugInstrumentation(
  (map: MapEngine, config: NodeSizeConfig) => {
    const sizeLayers = [
      "main-features-junctions",
      "delta-features-junctions",
      "ephemeral-junction-highlight",
      "highlights-marker",
      "selected-junctions",
    ];
    const radius = junctionCircleRadius(config);
    for (const layerId of sizeLayers) {
      if (!map.map.getLayer(layerId)) continue;
      map.setLayerPaintRule(layerId, "circle-radius", radius);
    }

    const visibilityLayers = [
      "main-features-junctions",
      "delta-features-junctions",
      "selected-junctions",
    ];
    const minzoom = junctionLayerMinZoom(config);
    for (const layerId of visibilityLayers) {
      if (!map.map.getLayer(layerId)) continue;
      map.setLayerMinZoom(layerId, minzoom);
    }
  },
  { name: "MAP_STATE:APPLY_JUNCTION_SIZE", maxDurationMs: 100 },
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
    const selectionSet = new Set(USelection.getAssetIds(selection));
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
        layerConfig.lineWidth,
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
        layerConfig.labelProperty,
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

const updateZoneColors = (
  map: MapEngine,
  zone: ZoneSymbology,
  zoneColorAssignments: Record<number, string>,
) => {
  let fillColor: mapboxgl.Expression | string = zone.defaults.color;

  if (zone.colorRule === "label") {
    fillColor = buildZoneColorExpression(
      zoneColorAssignments,
      zone.defaults.color,
    );
  }

  map.setLayerPaintRule(
    "zones-fill",
    "fill-color",
    fillColor as unknown as mapboxgl.Expression,
  );

  const outlineColor = zone.defaults.color;
  map.setLayerPaintRule(
    "zones-outline",
    "line-color",
    outlineColor as unknown as mapboxgl.Expression,
  );
};

const ZONE_LAYERS = ["zones-fill", "zones-outline", "zones-labels"] as const;

const toggleZoneLayers = (
  map: MapEngine,
  zone: { visible: boolean; labelRule: string | null },
) => {
  if (!zone.visible) {
    map.hideLayers([...ZONE_LAYERS]);
    return;
  }

  map.showLayers(["zones-fill", "zones-outline"]);

  if (zone.labelRule) {
    map.showLayers(["zones-labels"]);
  } else {
    map.hideLayers(["zones-labels"]);
  }
};

const updateZonesSource = async (
  map: MapEngine,
  features: GeoJSON.Feature[],
): Promise<void> => {
  await map.setSource(
    "zones",
    features as unknown as import("src/types").Feature[],
  );
};

const updateHighlightsSource = async (
  map: MapEngine,
  highlights: Highlight[],
  assets: AssetsMap,
): Promise<void> => {
  const features = buildHighlightsSource(highlights, assets);
  await map.setSource("highlights", features);
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
  const selectedCpIds = USelection.getCustomerPointIds(selection);
  if (selectedCpIds.length === 0) return [];

  const selectedCps = [];
  let anyActive = false;
  for (const id of selectedCpIds) {
    const customerPoint = customerPoints.get(id);
    if (!customerPoint) continue;
    selectedCps.push(customerPoint);
    const pipeId = customerPoint.connection?.pipeId;
    if (pipeId && assets.get(pipeId)?.isActive) anyActive = true;
  }
  if (selectedCps.length === 0) return [];
  return buildCustomerPointsSelectionOverlay(selectedCps, anyActive, zoom);
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
