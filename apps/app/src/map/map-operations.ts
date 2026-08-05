import { useAtomValue } from "jotai";
import type { AssetId } from "src/hydraulic-model";
import { filterAssets } from "src/hydraulic-model";
import type { LayerId } from "./layers";
import { useEnabledFeatureFlags } from "src/hooks/use-feature-flags";
import { mapBackendFallbackAtom } from "src/state/map";
import { withDebugInstrumentation } from "src/infra/with-instrumentation";
import { MapEngine } from "@epanet-js/map";
import type { MapOperations, RawData, ChangeFlags } from "@epanet-js/map";
import type { Style } from "mapbox-gl";
import {
  buildOptimizedAssetsSource,
  buildIconPointsSource,
  FeatureSources,
} from "./data-source";

export type {
  MapOperations,
  RawData,
  ChangeFlags,
  DefaultsResolvers,
} from "@epanet-js/map";

// The only dedicated selection layers are the pump/valve halos (selection is otherwise
// merged into the base layers via the `selected` prop) — hidden while an asset is moving.
const SELECTION_LAYERS: LayerId[] = [
  "selected-icons-halo",
  "delta-selected-icons-halo",
];

export const updateDeltaSource = withDebugInstrumentation(
  async (
    map: MapEngine,
    ctx: RawData,
    liveSetIds: Set<AssetId>,
  ): Promise<void> => {
    const liveAssets = filterAssets(ctx.assets, liveSetIds);
    const features = await buildOptimizedAssetsSource(
      liveAssets,
      ctx.symbology,
      ctx.units,
      ctx.formatting,
      ctx.translateUnit,
      ctx.simulationResults,
      ctx.selectedIds,
      ctx.defaultsResolvers,
    );
    map.setSource(FeatureSources.DELTA, features);

    const iconFeatures = buildIconPointsSource(
      liveAssets,
      ctx.selectedIds,
      ctx.simulationResults,
    );
    map.setSource("delta-icons", iconFeatures);
  },
  { name: "MAP_STATE:UPDATE_DELTA_SOURCE", maxDurationMs: 250 },
);

export { SELECTION_LAYERS };

// ---- geojson implementation (the public default) ------------------------------------

const applyStyle = async (map: MapEngine, style: Style) => {
  await map.setStyle(style);
};

const rebuildDataSources = async (
  map: MapEngine,
  ctx: RawData,
): Promise<void> => {
  const {
    assets,
    symbology,
    units,
    formatting,
    translateUnit,
    simulationResults,
    selectedIds,
    defaultsResolvers,
  } = ctx;

  const features = await buildOptimizedAssetsSource(
    assets,
    symbology,
    units,
    formatting,
    translateUnit,
    simulationResults,
    selectedIds,
    defaultsResolvers,
  );
  map.setSource(FeatureSources.MAIN, features);
  const iconFeatures = buildIconPointsSource(
    assets,
    selectedIds,
    simulationResults,
  );
  map.setSource("icons", iconFeatures);
};

const finalizeConsolidation = (
  map: MapEngine,
  keepHiddenIds: Set<AssetId>,
  cleanUpEdits: boolean,
): void => {
  map.clearFeatureState(FeatureSources.MAIN);
  map.clearFeatureState("icons");
  for (const assetId of keepHiddenIds) {
    map.hideFeature(FeatureSources.MAIN, assetId);
    map.hideFeature("icons", assetId);
  }
  if (cleanUpEdits) {
    map.setSource(FeatureSources.DELTA, []);
    map.setSource("delta-icons", []);
  }
};

const updateDataSources = async (
  map: MapEngine,
  ctx: RawData,
  _changeFlags: ChangeFlags,
): Promise<{ consolidated: boolean }> => {
  await rebuildDataSources(map, ctx);
  return { consolidated: true };
};

// Hide the edited/deselected assets in MAIN (main-features geometry + icons) so they
// render only from delta. Diffs against the previously-hidden set rather than clearing
// all feature-state, so a still-hidden asset is never briefly un-hidden (which flashed
// stale geometry on a move-drop).
const syncSourceEdits = (
  map: MapEngine,
  hiddenInMainIds: Set<AssetId>,
  previouslyHiddenIds: Set<AssetId>,
): Promise<void> => {
  for (const assetId of previouslyHiddenIds) {
    if (hiddenInMainIds.has(assetId)) continue;
    map.showFeature(FeatureSources.MAIN, assetId);
    map.showFeature("icons", assetId);
  }
  for (const assetId of hiddenInMainIds) {
    if (previouslyHiddenIds.has(assetId)) continue;
    map.hideFeature(FeatureSources.MAIN, assetId);
    map.hideFeature("icons", assetId);
  }
  return Promise.resolve();
};

const updateEditionsVisibility = (
  map: MapEngine,
  previousMovedAssetIds: Set<AssetId>,
  movedAssetIds: Set<AssetId>,
  hiddenInMainIds: Set<AssetId>,
): void => {
  for (const assetId of previousMovedAssetIds.values()) {
    map.showFeature("delta-features", assetId);
    map.showFeature("delta-icons", assetId);

    if (hiddenInMainIds.has(assetId)) continue;

    map.showFeature("main-features", assetId);
    map.showFeature("icons", assetId);
  }

  for (const assetId of movedAssetIds.values()) {
    map.hideFeature("delta-features", assetId);
    map.hideFeature("delta-icons", assetId);

    if (hiddenInMainIds.has(assetId)) continue;

    map.hideFeature("main-features", assetId);
    map.hideFeature("icons", assetId);
  }

  if (movedAssetIds.size > 0) {
    map.hideLayers(SELECTION_LAYERS);
  } else if (previousMovedAssetIds.size > 0) {
    map.showLayers(SELECTION_LAYERS);
  }
};

export const mapOperations: MapOperations = {
  applyStyle,
  rebuildDataSources,
  finalizeConsolidation,
  updateDataSources,
  syncSourceEdits,
  updateEditionsVisibility,
};

// ---- backend selection --------------------------------------------------------------

type FlagReader = (name: string) => boolean;
type MapOperationsSelector = (flags: FlagReader) => MapOperations | null;

// Default: no alternative backend registered → always geojson. A private backend file
// calls `registerMapOperations` with a flag-gated selector at module load; the flag string
// that enables it lives only in that private file, never here.
let selector: MapOperationsSelector | null = null;

export const registerMapOperations = (next: MapOperationsSelector): void => {
  selector = next;
};

export const useMapOperations = (): MapOperations => {
  const enabledFlags = useEnabledFeatureFlags();
  const fellBack = useAtomValue(mapBackendFallbackAtom);
  const flags: FlagReader = (name) => enabledFlags.includes(name);
  // Once a backend has reported itself unavailable, always use the geojson default.
  if (fellBack) return mapOperations;
  return selector?.(flags) ?? mapOperations;
};
