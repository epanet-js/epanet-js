import { Unit } from "src/quantity";
import {
  CategoryStats,
  QuantityStatsDeprecated,
} from "../asset-property-stats";
import { Asset } from "src/hydraulic-model";

export type { CategoryStats };

export type QuantityStats = QuantityStatsDeprecated & {
  decimals: number;
  unit: Unit;
};

type Section =
  | "activeTopology"
  | "modelAttributes"
  | "simulationResults"
  | "demands";

export type AssetPropertyStats = QuantityStats | CategoryStats;

export type AssetPropertySections = {
  [section in Section]: AssetPropertyStats[];
};

export type MultiAssetsData = {
  [type in Asset["type"]]: AssetPropertySections;
};

export type AssetCounts = {
  [type in Asset["type"]]: number;
};

export type ComputedMultiAssetData = {
  data: MultiAssetsData;
  counts: AssetCounts;
};
