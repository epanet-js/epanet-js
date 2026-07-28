// Faceted map-source path, gated by the COMBINED flag FLAG_MAP_FACETED_SOURCES
// (faceted ⟹ serialized-sync). This is a duplicate of the V2 serialized scheduler
// (state-updates.ts) with icons exploded into main/delta facets and selection
// converged to a `selected` prop + filtered layers + delta live-set. Kept parallel
// so the fork-critical geojson rendering can bake behind a flag before promotion.
// Remove the pre-facet path (state-updates.ts) at promotion and rename this into place.
import { useAtomValue, useSetAtom } from "jotai";
import { type MutableRefObject, useRef } from "react";
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
import { MapEngine } from "@epanet-js/map";
import { prepareIconsSprite, type IconImage } from "./icons";
import {
  buildEphemeralStateSource,
  buildHighlightsSource,
} from "./data-source";
import type { Highlight } from "src/state/highlights";
import mapboxgl from "mapbox-gl";
import { Grid } from "./grid";
import {
  useMapOperations,
  updateDeltaSource,
  type RawData,
  type MapOperations,
} from "./map-operations";
import {
  buildBaseStyle,
  defineEmptySourcesFaceted,
  makeFacetedLayers,
} from "./build-style";
import { gisDataAtom } from "src/state/gis-data";
import {
  gisLayerFill,
  gisLayerLine,
  gisLayerCircle,
  gisLayerLabel,
} from "./layers/gis-layer";
import { AssetId, AssetsMap } from "src/hydraulic-model";
import { captureError } from "src/infra/error-tracking";
import { enrichError } from "src/infra/errors";
import { wasSuspendedSince } from "src/infra/tab-visibility";
import { withDebugInstrumentation } from "src/infra/with-instrumentation";
import { yieldToMain } from "src/infra/yield-to-main";
import { USelection } from "src/selection";
import { SymbologySpec } from "src/state/map-symbology";
import type { ZoneSymbology, NodeSizeConfig } from "src/map/symbology";
import { buildZoneColorExpression } from "src/map/layers/zones";

import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import {
  CustomerPointsOverlay,
  buildCustomerPointsOverlay,
  buildCustomerPointsHighlightOverlay,
  applyCustomerPointsStyles,
  buildConnectCustomerPointsPreviewOverlay,
  buildMovingCustomerPointOverlay,
  updateCustomerPointsOverlayVisibility,
} from "./overlays/customer-points";
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

// An update cycle over this is flagged (debug builds only) — the
// withDebugInstrumentation warning fires only when isDebugOn.
const SLOW_UPDATE_WARN_MS = 1000;
const MAP_STATE_SYNC = "MAP_STATE:SYNC";

// TEMP: debug logging for the selection consolidation decision. Flip off when done.
const FACETED_DEBUG = true;
const dbgIds = (set: Set<AssetId>): string =>
  set.size > 12 ? `${set.size} ids` : `[${[...set].join(",")}]`;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const flog = (...args: any[]): void => {
  // eslint-disable-next-line no-console
  if (FACETED_DEBUG) console.log("[faceted]", ...args);
};

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
  const hiddenInMainRef = useRef<Set<AssetId>>(new Set());
  // The icon sprite is static; prepare it once per map and reuse across style
  // rebuilds (the engine no longer prepares icons — the updater passes them in).
  const iconsRef = useRef<IconImage[] | null>(null);
  const pendingConsolidationFinalizeRef = useRef(false);
  const pendingDeltaCleanupRef = useRef(false);
  const consolidatedSelectionRef = useRef<Set<AssetId>>(new Set());
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
  const ephemeralDeckLayersRef = useRef<CustomerPointsOverlay>([]);
  const gridRef = useRef<Grid | null>(null);
  const scaleControlRef = useRef<mapboxgl.ScaleControl | null>(null);
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const mapOperations = useMapOperations();

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
      const rawData: RawData = {
        assets,
        symbology: mapState.symbology,
        units,
        formatting,
        translateUnit,
        simulationResults: mapState.resultsReader,
        selectedIds,
      };

      if (isHeavyUpdate(changes, mapState)) {
        setMapLoading(true);
        settleRef.current = {
          startedAt: performance.now(),
          measurable:
            (hasNewResults || hasNewSymbologyRules) && !document.hidden,
        };
      }

      let consolidated = false;

      if (hasNewStyles) {
        iconsRef.current = await applyStyles(
          map,
          mapState,
          mapOperations,
          translate,
          gisData,
          iconsRef.current,
        );
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

      if (hasNewDefaultColors && !hasNewStyles) {
        updateDefaultMapColors(
          map,
          mapState.symbology.node.defaults.color,
          mapState.symbology.link.defaults.color,
        );
      }

      if (hasNewZoneColorAssignments || hasNewStyles) {
        updateZoneColors(
          map,
          mapState.symbology.zone,
          mapState.zoneColorAssignments,
        );
      }

      if (hasNewZoneSymbology || hasNewStyles) {
        toggleZoneLayers(map, mapState.symbology.zone);
      }

      if (hasNewStyles || hasNewNodeSize || hasNewImport) {
        applyJunctionSize(map, mapState.nodeSize);
      }

      const consolidatedSelectedIds = consolidatedSelectionRef.current;
      const selectionDiff = new Set<AssetId>();
      for (const id of selectedIds) {
        if (!consolidatedSelectedIds.has(id)) selectionDiff.add(id); // additions
      }
      for (const id of consolidatedSelectedIds) {
        if (!selectedIds.has(id)) selectionDiff.add(id); // removals
      }
      const hasBigSelection =
        selectionDiff.size > SELECTION_CONSOLIDATION_THRESHOLD;

      const rebuildFamily =
        hasSyncMomentChanged || hasNewImport || hasNewStyles;
      const propFamily =
        hasNewSymbologyRules ||
        (hasNewSimulation && mapState.simulation.status !== "running") ||
        hasNewResults ||
        hasBigSelection;
      const syncMain = rebuildFamily || propFamily;

      if (syncMain) {
        // Instrumentation lives on the caller (not the backend ops) so the backend impls
        // stay plain functions — a rebuild or a prop-reflect is one MAIN-sync span either way.
        await withDebugInstrumentation(
          async () => {
            if (rebuildFamily) {
              await mapOperations.rebuildDataSources(map, rawData);
              consolidated = true;
            } else {
              ({ consolidated } = await mapOperations.updateDataSources(
                map,
                rawData,
                {
                  symbology: hasNewSymbologyRules,
                  simulation:
                    (hasNewSimulation &&
                      mapState.simulation.status !== "running") ||
                    hasNewResults,
                  selection: hasBigSelection,
                },
              ));
            }
          },
          { name: "MAP_STATE:UPDATE_MAP_DATA", maxDurationMs: 10000 },
        )();

        flog(
          consolidated
            ? "CONSOLIDATED main (rebuilt)"
            : "main patched (NOT consolidated)",
          "via",
          rebuildFamily ? "rebuildDataSources" : "updateDataSources",
          "| trigger",
          [
            hasSyncMomentChanged && "syncMoment",
            hasNewImport && "import",
            hasNewStyles && "styles",
            hasNewSymbologyRules && "symbology",
            hasNewSimulation && "simulation",
            hasNewResults && "results",
            hasBigSelection && "selectionConsolidation",
          ]
            .filter(Boolean)
            .join(",") || "-",
          "| selected",
          dbgIds(selectedIds),
          "| selectionDiff",
          dbgIds(selectionDiff),
        );

        if (consolidated) {
          consolidatedSelectionRef.current = selectedIds;
          setMapSyncMoment((prev) => {
            return { pointer: momentLog.getPointer(), version: prev.version };
          });
          hiddenInMainRef.current = new Set();
          pendingConsolidationFinalizeRef.current = true;
          pendingDeltaCleanupRef.current = true;
        }
      }

      // Delta sync outside a main sync: on new edits, a selection change below the re-bake
      // threshold, or the moved-set changing (drag start / drop). Re-derive delta (edited ∪
      // selection diff − moving); edited assets and deselected-baked assets are hidden in main,
      // additions are overlaid by delta on top.
      if (
        (hasNewEditions ||
          hasNewAssetsSelection ||
          hasEphemeralTargetsChanged) &&
        !syncMain
      ) {
        flog(
          "delta-only update (NOT consolidated)",
          "| trigger",
          [
            hasNewEditions && "editions",
            hasNewAssetsSelection && "selection",
            hasEphemeralTargetsChanged && "ephemeralTargets",
          ]
            .filter(Boolean)
            .join(",") || "-",
          "| selectionDiff",
          dbgIds(selectionDiff),
        );
        // Set math (backend-agnostic): the live-set rides delta (edited ∪ selection diff −
        // moving); edited and deselected-baked assets are hidden in MAIN, additions overlaid
        // by delta on top. The backend impl applies it (delta rebuild + MAIN feature-state).
        const editedSinceConsolidation = getAssetIdsInMoments(
          momentLog.getDeltas(mapState.syncMomentPointer),
        );
        const liveSetIds = new Set(editedSinceConsolidation);
        for (const id of selectionDiff) liveSetIds.add(id);
        for (const id of mapState.movedAssetIds) liveSetIds.delete(id);

        const hiddenInMainIds = new Set(editedSinceConsolidation);
        for (const id of selectionDiff) {
          if (!selectedIds.has(id)) hiddenInMainIds.add(id);
        }

        await updateDeltaSource(map, rawData, liveSetIds);
        await mapOperations.syncSourceEdits(
          map,
          hiddenInMainIds,
          hiddenInMainRef.current,
        );
        hiddenInMainRef.current = hiddenInMainIds;
        pendingDeltaCleanupRef.current = false;
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

      // Selection is stored as an id array; use a Set for O(1) per-point
      // lookups in the deck.gl accessors. The array reference is stable across
      // non-selection updates, so it doubles as the updateTrigger.
      const customerPointsSelectionToken = USelection.getCustomerPointIds(
        mapState.selection,
      );
      const selectedCustomerPointIds = new Set(customerPointsSelectionToken);

      if (
        hasNewImport ||
        hasNewEditions ||
        hasNewStyles ||
        hasNewCustomerPoints ||
        customerPointExclusionChanged
      ) {
        // updateCustomerPointsOverlay
        const excludedCustomerPointIds = movingCustomerPointId
          ? new Set([movingCustomerPointId])
          : undefined;

        customerPointsOverlayRef.current = buildCustomerPointsOverlay(
          hydraulicModel.customerPoints,
          assets,
          mapState.currentZoom,
          excludedCustomerPointIds,
          selectedCustomerPointIds,
          customerPointsSelectionToken,
        );
      }

      if (
        hasNewZoom ||
        hasNewCustomerPointsSelection ||
        hasNewCustomerPointsSymbology ||
        hasEphemeralStateReset
      ) {
        // Re-clone the overlay layers into fresh deck.gl instances to force the update.
        customerPointsOverlayRef.current =
          updateCustomerPointsOverlayVisibility(
            customerPointsOverlayRef.current,
            mapState.currentZoom,
          );

        ephemeralDeckLayersRef.current = updateCustomerPointsOverlayVisibility(
          ephemeralDeckLayersRef.current,
          mapState.currentZoom,
        );
      }

      if (hasNewEphemeralState) {
        // update customer points ephemeral state
        ephemeralDeckLayersRef.current = buildCustomerPointsEphemeralOverlay(
          mapState.ephemeralState,
          mapState.currentZoom,
        );
      }

      // Fold selection into the existing base overlay instead of building a
      // second full-size overlay: only the fill/stroke attributes recompute
      // (via updateTriggers), the point buffers are reused. A customer-points
      // change already re-applies selection through the rebuild above.
      if (hasNewCustomerPointsSelection) {
        customerPointsOverlayRef.current = applyCustomerPointsStyles(
          customerPointsOverlayRef.current,
          selectedCustomerPointIds,
          customerPointsSelectionToken,
        );
      }

      if (hasNewEphemeralState) {
        // update assets ephemeral state
        mapOperations.updateEditionsVisibility(
          map,
          previousMapState.movedAssetIds,
          mapState.movedAssetIds,
          hiddenInMainRef.current,
        );
        updateEphemeralStateSource(map, mapState.ephemeralState, assets);
      }

      if (hasNewMapOverlay) {
        // update overlay state
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

      if (
        (hasNewSymbologyRules && !hasNewStyles) ||
        hasNewAssetsSelection ||
        hasNewEditions
      ) {
        // update analysis layers visibility
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
        // update customer points overlay visibility
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
    if (hasOutstandingHeavyUpdate()) {
      if (settleRef.current) settleRef.current.measurable = false;
      return;
    }

    if (map && pendingConsolidationFinalizeRef.current) {
      mapOperations.finalizeConsolidation(
        map,
        hiddenInMainRef.current,
        pendingDeltaCleanupRef.current,
      );
      pendingConsolidationFinalizeRef.current = false;
      pendingDeltaCleanupRef.current = false;
    }

    const settle = settleRef.current;
    if (!settle) return;

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

const applyStyles = withDebugInstrumentation(
  async (
    map: MapEngine,
    mapState: MapState,
    mapOperations: MapOperations,
    translate: (key: string) => string,
    gisData: Map<string, import("geojson").FeatureCollection>,
    icons: IconImage[] | null,
  ): Promise<IconImage[]> => {
    map.suspendOverlayStyleReactions();
    resetMapState(map);
    const style = await buildStyle(mapState, translate, gisData);
    await mapOperations.applyStyle(map, style);
    const iconSprites = icons ?? (await prepareIconsSprite());
    map.addIcons(iconSprites);
    map.resumeOverlayStyleReactions();
    toggleAnalysisLayers(map, mapState.symbology);
    return iconSprites;
  },
  { name: "MAP_STATE:APPLY_STYLES", maxDurationMs: 1000 },
);

const buildStyle = async (
  mapState: MapState,
  translate: (key: string) => string,
  gisData: Map<string, import("geojson").FeatureCollection>,
): Promise<mapboxgl.Style> => {
  const style = await buildBaseStyle({
    layerConfigs: mapState.stylesConfig.layerConfigs,
    translate,
  });
  defineEmptySourcesFaceted(style);
  addGisLayersToStyle(style, mapState.stylesConfig, gisData);
  style.layers.push(
    ...makeFacetedLayers({
      symbology: mapState.stylesConfig.symbology,
      previewProperty: mapState.stylesConfig.previewProperty,
      nodeDefaults: mapState.symbology.node.defaults,
      linkDefaults: mapState.symbology.link.defaults,
    }),
  );
  return style;
};

const resetMapState = (map: MapEngine) => {
  map.removeSource("delta-features");
  map.removeSource("main-features");
};

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

function addGisLayersToStyle(
  style: mapboxgl.Style,
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
    style.sources[sourceId] = { type: "geojson", data };

    style.layers.push(
      gisLayerFill(
        sourceId,
        layerConfig.color,
        layerConfig.opacity,
        layerConfig.visibility,
      ),
      gisLayerLine(
        sourceId,
        layerConfig.color,
        layerConfig.lineWidth,
        layerConfig.opacity,
        layerConfig.visibility,
      ),
      gisLayerCircle(
        sourceId,
        layerConfig.color,
        layerConfig.lineWidth,
        layerConfig.opacity,
        layerConfig.visibility,
      ),
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
