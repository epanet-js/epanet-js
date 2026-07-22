import type { Unit } from "@epanet-js/quantity";
import type { AssetId, AssetsMap } from "src/hydraulic-model";
import type { StylesConfig } from "src/state/map";
import type { SymbologySpec } from "src/state/map-symbology";
import type { ResultsReader } from "src/simulation/results-reader";
import type {
  FormattingSpec,
  UnitsSpec,
} from "src/lib/project-settings/quantities-spec";
import type { NodeDefaults, LinkDefaults } from "src/map/symbology";
import { useEnabledFeatureFlags } from "src/hooks/use-feature-flags";
import { withDebugInstrumentation } from "src/infra/with-instrumentation";
import { MapEngine } from "./map-engine";
import {
  buildBaseStyle,
  makeFacetedLayers,
  defineFacetedSources,
} from "./build-style";
import {
  buildOptimizedAssetsSource,
  buildIconPointsSource,
  FeatureSources,
} from "./data-source";

export type RawData = {
  assets: AssetsMap;
  symbology: SymbologySpec;
  units: UnitsSpec;
  formatting: FormattingSpec;
  translateUnit: (unit: Unit) => string;
  simulationResults: ResultsReader | null | undefined;
  selectedIds: Set<AssetId>;
};

export type ChangeFlags = {
  symbology: boolean;
  simulation: boolean;
  selection: boolean;
};

export interface MapOperations {
  setBaseStyleAndEmptyDataSources(
    map: MapEngine,
    styles: StylesConfig,
    translate: (key: string) => string,
  ): Promise<void>;

  registerAssetLayers(
    map: MapEngine,
    styles: StylesConfig,
    nodeDefaults: NodeDefaults,
    linkDefaults: LinkDefaults,
  ): void;

  rebuildDataSources(map: MapEngine, ctx: RawData): Promise<void>;

  cleanUpNonConsolidatedDataSources(map: MapEngine): void;

  updateDataSources(
    map: MapEngine,
    ctx: RawData,
    changeFlags: ChangeFlags,
  ): Promise<{ consolidated: boolean }>;
}

// ---- geojson implementation (the public default) ------------------------------------

const setBaseStyleAndEmptyDataSources = withDebugInstrumentation(
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

const registerAssetLayers = (
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

const rebuildDataSources = withDebugInstrumentation(
  async (map: MapEngine, ctx: RawData): Promise<void> => {
    const {
      assets,
      symbology,
      units,
      formatting,
      translateUnit,
      simulationResults,
      selectedIds,
    } = ctx;

    const features = await buildOptimizedAssetsSource(
      assets,
      symbology,
      units,
      formatting,
      translateUnit,
      simulationResults,
      selectedIds,
    );
    map.setSource(FeatureSources.MAIN, features);
    const iconFeatures = buildIconPointsSource(
      assets,
      selectedIds,
      simulationResults,
    );
    map.setSource("icons", iconFeatures);
  },
  {
    name: "MAP_STATE:UPDATE_MAIN_SOURCE",
    maxDurationMs: 10000,
  },
);

const cleanUpNonConsolidatedDataSources = (map: MapEngine) => {
  map.setSource(FeatureSources.DELTA, []);
  map.setSource("delta-icons", []);
  map.clearFeatureState(FeatureSources.MAIN);
  map.clearFeatureState("icons");
};

const updateDataSources = async (
  map: MapEngine,
  ctx: RawData,
  _changeFlags: ChangeFlags,
): Promise<{ consolidated: boolean }> => {
  await rebuildDataSources(map, ctx);
  return { consolidated: true };
};

export const mapOperations: MapOperations = {
  setBaseStyleAndEmptyDataSources,
  registerAssetLayers,
  rebuildDataSources,
  cleanUpNonConsolidatedDataSources,
  updateDataSources,
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
  const flags: FlagReader = (name) => enabledFlags.includes(name);
  return selector?.(flags) ?? mapOperations;
};
