import type { Unit } from "@epanet-js/quantity";
import type { Asset, AssetId, AssetsMap } from "@epanet-js/hydraulic-model";
import type { ResultsReader } from "@epanet-js/simulation";
import type { FormattingSpec, UnitsSpec } from "@epanet-js/project-settings";
import type { Style } from "mapbox-gl";
import { MapEngine } from "./map-engine";
import type { RenderSymbology } from "./symbology";

export type RawData = {
  assets: AssetsMap;
  symbology: RenderSymbology;
  units: UnitsSpec;
  formatting: FormattingSpec;
  translateUnit: (unit: Unit) => string;
  simulationResults: ResultsReader | null | undefined;
  selectedIds: Set<AssetId>;
  defaultsResolvers?: DefaultsResolvers;
};

export type AssetFieldDefault = number | ((asset: Asset) => number | null);

export type DefaultsResolvers = Record<
  string,
  Record<string, AssetFieldDefault>
>;

export const resolveAssetDefault = (
  defaults: DefaultsResolvers | undefined,
  asset: Asset,
  property: string,
): number | null => {
  const fieldDefault = defaults?.[asset.type]?.[property];
  if (fieldDefault === undefined) return null;

  return typeof fieldDefault === "function"
    ? fieldDefault(asset)
    : fieldDefault;
};

export type ChangeFlags = {
  symbology: boolean;
  simulation: boolean;
  selection: boolean;
};
export interface MapOperations {
  prepare?(): Promise<void>;

  applyStyle(map: MapEngine, style: Style): Promise<void>;

  rebuildDataSources(map: MapEngine, ctx: RawData): Promise<void>;

  finalizeConsolidation(
    map: MapEngine,
    keepHiddenIds: Set<AssetId>,
    cleanUpEdits: boolean,
  ): void;

  updateDataSources(
    map: MapEngine,
    ctx: RawData,
    changeFlags: ChangeFlags,
  ): Promise<{ consolidated: boolean }>;

  syncSourceEdits(
    map: MapEngine,
    hiddenInMainIds: Set<AssetId>,
    previouslyHiddenIds: Set<AssetId>,
  ): Promise<void>;

  updateEditionsVisibility(
    map: MapEngine,
    previousMovedAssetIds: Set<AssetId>,
    movedAssetIds: Set<AssetId>,
    hiddenInMainIds: Set<AssetId>,
  ): void;
}
