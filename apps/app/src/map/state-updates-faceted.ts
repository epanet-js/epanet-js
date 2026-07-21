// Faceted map-source path, gated by the COMBINED flag FLAG_MAP_FACETED_SOURCES
// (faceted ⟹ serialized-sync). This is a duplicate of the V2 serialized scheduler
// (state-updates.ts) with icons exploded into main/delta facets and selection
// converged to a `selected` prop + filtered layers + delta live-set. Kept parallel
// so the fork-critical geojson rendering can bake behind a flag before promotion.
// Remove the pre-facet path (state-updates.ts) at promotion and rename this into place.
import type { Sel } from "src/selection";
import { useAtomValue, useSetAtom } from "jotai";
import { type MutableRefObject, useRef } from "react";
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
import { appendSourceRebuildDurationAtom } from "src/state/performance";
import { gridPreviewAtom, showGridAtom } from "src/state/map-projection";
import type { ResultsReader } from "src/simulation/results-reader";
import { MapEngine } from "./map-engine";
import {
  buildIconPointsSource,
  buildOptimizedAssetsSource,
  buildEphemeralStateSource,
  buildHighlightsSource,
  FeatureSources,
} from "./data-source";
import type { Highlight } from "src/state/highlights";
import mapboxgl from "mapbox-gl";
import { Grid } from "./grid";
import {
  buildBaseStyle,
  makeFacetedLayers,
  defineFacetedSources,
} from "./build-style";
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
import { enrichError } from "src/infra/errors";
import { wasSuspendedSince } from "src/infra/tab-visibility";
import { withDebugInstrumentation } from "src/infra/with-instrumentation";
import { yieldToMain } from "src/infra/yield-to-main";
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
  facetedJunctionFillColorExpression,
  facetedJunctionStrokeColorExpression,
  junctionCircleRadius,
  junctionLayerMinZoom,
} from "./layers/junctions";
import {
  facetedLinkColorExpression,
  facetedPipeArrowColorExpression,
} from "./layers/pipes";

const SELECTION_LAYERS: LayerId[] = [
  "selected-icons-halo",
  "delta-selected-icons-halo",
];

// An update cycle over this is flagged (debug builds only) — the
// withDebugInstrumentation warning fires only when isDebugOn.
const SLOW_UPDATE_WARN_MS = 1000;
const MAP_STATE_SYNC = "MAP_STATE:SYNC";

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

const sameSet = (a: Set<AssetId>, b: Set<AssetId>): boolean => {
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
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
  hasEphemeralTargetsChanged: boolean;
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
    hasEphemeralTargetsChanged: !sameSet(
      state.movedAssetIds,
      prev.movedAssetIds,
    ),
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

const LARGE_SELECTION_SIZE = 500;

// Limit for a consolidation of the main source
const SELECTION_CONSOLIDATION_THRESHOLD = 1000;
// Shared empty set (read-only in practice) for the un-baked / no-selection branches.
const EMPTY_SELECTION: Set<AssetId> = new Set<AssetId>();

const isHeavyUpdate = (
  changes: ReturnType<typeof detectChanges>,
  mapState: MapState,
): boolean => {
  const { assets, customerPoints } = USelection.countByKind(mapState.selection);
  const hasLargeSelection = assets + customerPoints > LARGE_SELECTION_SIZE;
  const hasNewSelection =
    changes.hasNewAssetsSelection || changes.hasNewCustomerPointsSelection;

  return (
    changes.hasSyncMomentChanged ||
    changes.hasNewImport ||
    changes.hasNewEditions ||
    changes.hasNewStyles ||
    changes.hasNewSymbologyRules ||
    (changes.hasNewSimulation && mapState.simulation.status !== "running") ||
    changes.hasNewResults ||
    (hasNewSelection && hasLargeSelection)
  );
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
  // Assets currently hidden in the main sources (feature-state) because they are
  // edited-since-consolidation and rendered from delta instead. Lets the next visibility
  // update diff instead of clearing all feature-state and re-hiding (which flashed stale
  // geometry on a move-drop). Reset whenever main is fully rebuilt; bounded by the
  // consolidation threshold (delta is folded back into main at ~MAX_CHANGES_BEFORE_MAP_SYNC).
  const hiddenInMainRef = useRef<Set<AssetId>>(new Set());
  // Whether the current main-features render has the selection baked in (large-selection
  // coalescing). When true, a selection change requires re-serializing main.
  const selectionBakedRef = useRef(false);
  const lastAppliedMapStateRef = useRef<MapState>(nullMapState);
  const freshMapStateRef = useRef<MapState>(mapState);
  freshMapStateRef.current = mapState;
  const appliedChangesRef = useRef<ReturnType<typeof detectChanges> | null>(
    null,
  );
  const syncMapStateRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const isRunningRef = useRef(false);
  const hasPendingRef = useRef(false);
  const settleRef = useRef<{ startedAt: number; measurable: boolean } | null>(
    null,
  );
  const customerPointsOverlayRef = useRef<CustomerPointsOverlay>([]);
  const selectionDeckLayersRef = useRef<CustomerPointsOverlay>([]);
  const ephemeralDeckLayersRef = useRef<CustomerPointsOverlay>([]);
  const gridRef = useRef<Grid | null>(null);
  const scaleControlRef = useRef<mapboxgl.ScaleControl | null>(null);
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();

  syncMapStateRef.current = withDebugInstrumentation(
    async () => {
      if (!map) return;
      appliedChangesRef.current = null;

      const previousMapState = lastAppliedMapStateRef.current;
      if (mapState === previousMapState) return;

      const changes = detectChanges(mapState, previousMapState, map);
      appliedChangesRef.current = changes;
      const {
        hasNewImport,
        hasNewStyles,
        hasNewEditions,
        hasNewAssetsSelection,
        hasNewCustomerPointsSelection,
        hasNewEphemeralState,
        hasEphemeralStateReset,
        hasEphemeralTargetsChanged,
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

      const selectedIds = new Set(USelection.getAssetIds(mapState.selection));

      if (isHeavyUpdate(changes, mapState)) {
        setMapLoading(true);
        settleRef.current = {
          startedAt: performance.now(),
          measurable:
            (hasNewResults || hasNewSymbologyRules) && !document.hidden,
        };
      }

      if (hasNewStyles) {
        map.suspendOverlayStyleReactions();
        resetMapState(map);
        await buildBaseStyleAndSetOnMap(map, mapState.stylesConfig, translate);
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

      // Large-selection coalescing: bake the selection into main-features rather than
      // moving the whole network into delta (see SELECTION_BAKE_FRACTION). Small
      // selections ride the delta live-set (`selectedForDelta`); `selectedIds` (full)
      // still stamps `selected` on delta members either way.
      const isBigSelection =
        selectedIds.size > SELECTION_CONSOLIDATION_THRESHOLD;
      const bakedSelectedIds = isBigSelection ? selectedIds : EMPTY_SELECTION;
      const selectedForDelta = isBigSelection ? EMPTY_SELECTION : selectedIds;

      // Rebuild main on a consolidation trigger, or when a selection change needs the
      // bake (re-)applied (large selection) or removed (leaving the baked state).
      const rebuildMain =
        hasSyncMomentChanged ||
        hasNewImport ||
        hasNewStyles ||
        hasNewSymbologyRules ||
        (hasNewSimulation && mapState.simulation.status !== "running") ||
        hasNewResults ||
        (hasNewAssetsSelection &&
          (isBigSelection || selectionBakedRef.current));

      if (rebuildMain) {
        await rebuildSources(
          map,
          assets,
          mapState.symbology,
          units,
          formatting,
          translateUnit,
          mapState.resultsReader,
          bakedSelectedIds,
        );
        selectionBakedRef.current = isBigSelection;
        setMapSyncMoment((prev) => {
          return { pointer: momentLog.getPointer(), version: prev.version };
        });
        // rebuildSources cleared delta and all main feature-state; re-derive the live-set
        // (edits are folded into main, so at head it is just the un-baked selection). The
        // previously-hidden set is empty because feature-state was just cleared.
        const { hiddenInMainIds } = await syncSourcesWithEdits(
          map,
          momentLog,
          momentLog.getPointer(),
          assets,
          mapState.symbology,
          units,
          formatting,
          translateUnit,
          mapState.resultsReader,
          selectedForDelta,
          selectedIds,
          EMPTY_SELECTION,
          mapState.movedAssetIds,
        );
        hiddenInMainRef.current = hiddenInMainIds;
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

      // Delta sync outside a main rebuild: on new edits, a small selection change, or the
      // moved-set changing (drag start / drop). Re-derive delta (edited ∪ un-baked
      // selection − moving); only edited assets are hidden in main, selected-unedited ones
      // are overlaid by delta on top.
      if (
        (hasNewEditions ||
          hasNewAssetsSelection ||
          hasEphemeralTargetsChanged) &&
        !rebuildMain
      ) {
        const { hiddenInMainIds } = await syncSourcesWithEdits(
          map,
          momentLog,
          mapState.syncMomentPointer,
          assets,
          mapState.symbology,
          units,
          formatting,
          translateUnit,
          mapState.resultsReader,
          selectedForDelta,
          selectedIds,
          hiddenInMainRef.current,
          mapState.movedAssetIds,
        );
        hiddenInMainRef.current = hiddenInMainIds;
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

        selectionDeckLayersRef.current = updateCustomerPointsOverlayVisibility(
          selectionDeckLayersRef.current,
          mapState.currentZoom,
        );

        ephemeralDeckLayersRef.current = updateCustomerPointsOverlayVisibility(
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
        selectionDeckLayersRef.current = buildSelectionOverlayForCustomerPoints(
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
          hiddenInMainRef.current,
        );
        updateEphemeralStateSource(map, mapState.ephemeralState, assets);
      }

      if (hasNewMapOverlay) {
        updateMapOverlaySource(map, mapState.mapOverlayFeatures);
      }

      if (hasNewZoneFeatures || hasNewStyles) {
        updateZonesSource(map, mapState.zoneFeatures);
      }

      const hasAssetHighlights = mapState.highlights.some(
        (h) => h.type === "asset",
      );
      if (hasNewHighlights || (hasAssetHighlights && hasNewEditions)) {
        updateHighlightsSource(map, mapState.highlights, assets);
      }

      // Selection is no longer a separate overlay source: it rides the delta live-set
      // (handled above) with the `selected` prop the faceted layers key off.

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
          ...(shouldHideSelectionDuringMove || shouldHideCustomerPointSelection
            ? []
            : selectionDeckLayersRef.current),
          ...ephemeralDeckLayersRef.current,
        ];
        map.setOverlay(combinedOverlay);
      }

      lastAppliedMapStateRef.current = mapState;
    },
    {
      name: MAP_STATE_SYNC,
      maxDurationMs: SLOW_UPDATE_WARN_MS,
    },
  );

  const hasOutstandingHeavyUpdate = (): boolean =>
    !!map &&
    isHeavyUpdate(
      detectChanges(
        freshMapStateRef.current,
        lastAppliedMapStateRef.current,
        map,
      ),
      freshMapStateRef.current,
    );

  const onSettled = (settledCleanly: boolean) => {
    const settle = settleRef.current;
    if (!settle) return;

    if (hasOutstandingHeavyUpdate()) {
      settle.measurable = false;
      return;
    }

    settleRef.current = null;
    setMapLoading(false);
    if (
      settle.measurable &&
      settledCleanly &&
      !wasSuspendedSince(settle.startedAt)
    ) {
      appendSourceRebuildDuration(performance.now() - settle.startedAt);
    }
  };

  const queueUpdate = () => {
    if (isRunningRef.current) {
      hasPendingRef.current = true;
      return;
    }

    isRunningRef.current = true;
    // Avoid blocking the main thread
    setTimeout(async () => {
      let hasRetried = false;
      try {
        do {
          hasPendingRef.current = false;
          try {
            await syncMapStateRef.current();
            hasRetried = false;
          } catch (error) {
            captureError(enrichError(MAP_STATE_SYNC, error), {
              "Map Changes": { ...appliedChangesRef.current },
            });
            // Attempt to re-apply
            if (!hasRetried) {
              hasRetried = true;
              hasPendingRef.current = true;
            }
          }
          // Yield to the main thread between coalesced applies
          if (hasPendingRef.current) await yieldToMain();
        } while (hasPendingRef.current);
      } finally {
        isRunningRef.current = false;
        map?.onNextIdle(onSettled);
      }
    }, 0);
  };

  if (map && mapState !== lastAppliedMapStateRef.current) {
    queueUpdate();
  }
};

const resetMapState = (map: MapEngine) => {
  map.removeSource("delta-features");
  map.removeSource("main-features");
};

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
    defineFacetedSources(style);
    await map.setStyle(style);
  },
  { name: "MAP_STATE:BUILD_BASE_STYLE", maxDurationMs: 1000 },
);

const applyJunctionSize = (map: MapEngine, config: NodeSizeConfig) => {
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
};

const toggleAnalysisLayers = (map: MapEngine, symbology: SymbologySpec) => {
  const arrowProperties = ["flow", "velocity", "unitHeadloss"];
  const showArrows =
    symbology.link.colorRule &&
    arrowProperties.includes(symbology.link.colorRule.property);
  // Faceted path: there is no `selected-pipe-arrows` overlay — selection color is merged
  // into the main/delta arrow layers via the faceted expression.
  if (!showArrows) {
    map.hideLayers(["main-features-pipe-arrows", "delta-features-pipe-arrows"]);
  } else {
    map.showLayers(["main-features-pipe-arrows", "delta-features-pipe-arrows"]);
  }
};

// Hide the EDITED assets in the main sources (main-features + icons): their geometry in
// main is stale, so they render only from delta. Selected-but-unedited assets are NOT
// hidden — their main geometry is still correct, and the delta layers (drawn on top)
// paint the selection over them.
//
// This diffs against the previously-hidden set rather than clearing all feature-state
// and re-hiding: `clearFeatureState` un-hides EVERY feature (including an edited asset's
// stale geometry) for a repaint before we re-hide it, which flashed the old geometry on
// a move-drop. Diffing only toggles what actually changed, so a still-hidden asset is
// never un-hidden.
const updateMainSourceVisibility = (
  map: MapEngine,
  editedAssetIds: Set<AssetId>,
  previouslyHiddenIds: Set<AssetId>,
): void => {
  for (const assetId of previouslyHiddenIds) {
    if (editedAssetIds.has(assetId)) continue;
    map.showFeature(FeatureSources.MAIN, assetId);
    map.showFeature("icons", assetId);
  }
  for (const assetId of editedAssetIds) {
    if (previouslyHiddenIds.has(assetId)) continue;
    map.hideFeature(FeatureSources.MAIN, assetId);
    map.hideFeature("icons", assetId);
  }
};

const rebuildSources = withDebugInstrumentation(
  async (
    map: MapEngine,
    assets: AssetsMap,
    symbology: SymbologySpec,
    units: UnitsSpec,
    formatting: FormattingSpec,
    translateUnit: (unit: Unit) => string,
    simulationResults: ResultsReader | null | undefined,
    // Selection baked into main for large selections (coalescing) — avoids moving the
    // whole network into delta. Empty for the common (small) case, where selection
    // rides the delta live-set instead.
    bakedSelectedIds: Set<AssetId>,
  ): Promise<void> => {
    const features = await buildOptimizedAssetsSource(
      assets,
      symbology,
      units,
      formatting,
      translateUnit,
      simulationResults,
      bakedSelectedIds,
    );
    map.setSource(FeatureSources.MAIN, features);
    map.setSource(FeatureSources.DELTA, []);

    const iconFeatures = buildIconPointsSource(
      assets,
      bakedSelectedIds,
      simulationResults,
    );
    map.setSource("icons", iconFeatures);
    map.setSource("delta-icons", []);

    map.clearFeatureState(FeatureSources.MAIN);
    map.clearFeatureState("icons");
  },
  {
    name: "MAP_STATE:UPDATE_MAIN_SOURCE",
    maxDurationMs: 10000,
  },
);

const updateDeltaSource = withDebugInstrumentation(
  async (
    map: MapEngine,
    assets: AssetsMap,
    liveSetIds: Set<AssetId>,
    symbology: SymbologySpec,
    units: UnitsSpec,
    formatting: FormattingSpec,
    translateUnit: (unit: Unit) => string,
    simulationResults: ResultsReader | null | undefined,
    selectedIds: Set<AssetId>,
  ): Promise<void> => {
    // Delta holds the live-set (edited ∪ selected). `selected` is stamped so the
    // faceted layers render the selection highlight for selected members.
    const liveAssets = filterAssets(assets, liveSetIds);
    const features = await buildOptimizedAssetsSource(
      liveAssets,
      symbology,
      units,
      formatting,
      translateUnit,
      simulationResults,
      selectedIds,
    );
    map.setSource(FeatureSources.DELTA, features);

    const iconFeatures = buildIconPointsSource(
      liveAssets,
      selectedIds,
      simulationResults,
    );
    map.setSource("delta-icons", iconFeatures);
  },
  {
    name: "MAP_STATE:UPDATE_DELTA_SOURCE",
    maxDurationMs: 250,
  },
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
  simulationResults: ResultsReader | null | undefined,
  // Selection added to the delta live-set (the whole selection when it is small; empty
  // when it is large and baked into main instead — coalescing).
  selectedForDelta: Set<AssetId>,
  // Full selection, used to stamp `selected` on delta members (so an edited-and-selected
  // asset still renders selected from delta even while the bulk selection is baked).
  selectedIds: Set<AssetId>,
  // Assets currently hidden in main (from the previous cycle), so the hide can be diffed
  // rather than cleared-and-reapplied (which flashed stale geometry).
  previouslyHiddenIds: Set<AssetId>,
  // Existing assets whose geometry is being previewed live in the ephemeral source (move
  // targets / redraw source link). They render from the ephemeral source during the
  // gesture, so they are excluded from the delta live-set: such a *selected* asset would
  // otherwise sit in delta with stale geometry and, on drop, expose that stale geometry for
  // a frame while the new delta data reparses.
  ephemeralTargetIds: Set<AssetId>,
): Promise<{ hiddenInMainIds: Set<AssetId> }> => {
  const editedSinceConsolidation = getAssetIdsInMoments(
    momentLog.getDeltas(mapSyncMoment),
  );
  // Delta live-set = (edited-since-consolidation ∪ un-baked selection) − ephemeral targets.
  // It rides in delta so edits and small selections re-serialize only the small delta.
  const liveSetIds = new Set(editedSinceConsolidation);
  for (const assetId of selectedForDelta) liveSetIds.add(assetId);
  for (const assetId of ephemeralTargetIds) liveSetIds.delete(assetId);

  await updateDeltaSource(
    map,
    assets,
    liveSetIds,
    symbology,
    units,
    formatting,
    translateUnit,
    simulationResults,
    selectedIds,
  );

  // Only the edited assets are hidden in main (selected-unedited overlay from delta on
  // top). This is what the moved-asset visibility logic keys off, so return that set.
  updateMainSourceVisibility(
    map,
    editedSinceConsolidation,
    previouslyHiddenIds,
  );

  return { hiddenInMainIds: editedSinceConsolidation };
};

const updateEditionsVisibility = (
  map: MapEngine,
  previousMovedAssetIds: Set<AssetId>,
  movedAssetIds: Set<AssetId>,
  // Assets currently hidden in the main sources because they are edited-since-
  // consolidation (rendered from delta). A previously-moved asset that is now a committed
  // edit must stay hidden in main — un-hiding it would flash its stale main geometry.
  hiddenInMainIds: Set<AssetId>,
) => {
  for (const assetId of previousMovedAssetIds.values()) {
    map.showFeature("delta-features", assetId);
    map.showFeature("delta-icons", assetId);
    map.showFeature("icons", assetId);

    if (hiddenInMainIds.has(assetId)) continue;

    map.showFeature("main-features", assetId);
  }

  for (const assetId of movedAssetIds.values()) {
    map.hideFeature("delta-features", assetId);
    map.hideFeature("delta-icons", assetId);
    map.hideFeature("icons", assetId);

    if (hiddenInMainIds.has(assetId)) continue;

    map.hideFeature("main-features", assetId);
  }

  if (movedAssetIds.size > 0) {
    map.hideLayers(SELECTION_LAYERS);
  } else if (previousMovedAssetIds.size > 0) {
    map.showLayers(SELECTION_LAYERS);
  }
};

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

const addEditingLayersToMap = (
  map: MapEngine,
  stylesConfig: StylesConfig,
  nodeDefaults: NodeDefaults,
  linkDefaults: LinkDefaults,
) => {
  const layers = makeFacetedLayers({
    symbology: stylesConfig.symbology,
    previewProperty: stylesConfig.previewProperty,
    nodeDefaults,
    linkDefaults,
  });

  for (const layer of layers) {
    map.addLayer(layer);
  }
};

const updateDefaultMapColors = (
  map: MapEngine,
  nodeColor: string,
  linkColor: string,
) => {
  // Both main and delta feature layers carry the faceted (selection-merged) color
  // expressions, so a default-color change must re-apply the faceted expression on
  // both — the same ones the faceted layer factories use.
  for (const layerId of [
    "main-features-junctions",
    "delta-features-junctions",
  ] as const) {
    map.setLayerPaintRule(
      layerId,
      "circle-color",
      facetedJunctionFillColorExpression(nodeColor),
    );
    map.setLayerPaintRule(
      layerId,
      "circle-stroke-color",
      facetedJunctionStrokeColorExpression(nodeColor),
    );
  }

  for (const layerId of [
    "main-features-pipes",
    "delta-features-pipes",
  ] as const) {
    map.setLayerPaintRule(
      layerId,
      "line-color",
      facetedLinkColorExpression(linkColor),
    );
  }

  for (const layerId of [
    "main-features-pipe-arrows",
    "delta-features-pipe-arrows",
  ] as const) {
    map.setLayerPaintRule(
      layerId,
      "icon-color",
      facetedPipeArrowColorExpression(linkColor),
    );
  }
};

const updateEphemeralStateSource = withDebugInstrumentation(
  (
    map: MapEngine,
    ephemeralState: EphemeralEditingState,
    assets: AssetsMap,
  ): void => {
    const features = buildEphemeralStateSource(ephemeralState, assets);
    map.setSource("ephemeral", features);
  },
  {
    name: "MAP_STATE:UPDATE_EPHEMERAL_STATE_SOURCE",
    maxDurationMs: 100,
  },
);

const updateMapOverlaySource = (
  map: MapEngine,
  features: GeoJSON.Feature[],
): void => {
  map.setSource(
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

const updateZonesSource = (
  map: MapEngine,
  features: GeoJSON.Feature[],
): void => {
  map.setSource("zones", features as unknown as import("src/types").Feature[]);
};

const updateHighlightsSource = withDebugInstrumentation(
  (map: MapEngine, highlights: Highlight[], assets: AssetsMap): void => {
    const features = buildHighlightsSource(highlights, assets);
    map.setSource("highlights", features);
  },
  { name: "MAP_STATE:UPDATE_HIGHLIGHTS_SOURCE" },
);

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
