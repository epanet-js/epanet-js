import {
  UnitsSpec,
  FormattingSpec,
} from "src/lib/project-settings/quantities-spec";
import type { ResultsReader } from "src/simulation/results-reader";
import type { SimulationSettings } from "src/simulation/simulation-settings";
import { Asset, HydraulicModel } from "src/hydraulic-model";

import { type PropertyStats } from "./stats";

type Section =
  | "activeTopology"
  | "modelAttributes"
  | "quality"
  | "energy"
  | "simulationResults"
  | "demands"
  | "energyResults";

export type AssetPropertySections = {
  [section in Section]: PropertyStats[];
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

const emptyAssetPropertySections = (): AssetPropertySections => ({
  activeTopology: [],
  modelAttributes: [],
  quality: [],
  energy: [],
  simulationResults: [],
  demands: [],
  energyResults: [],
});

export const emptyComputedMultiAssetData = (): ComputedMultiAssetData => ({
  data: {
    junction: emptyAssetPropertySections(),
    pipe: emptyAssetPropertySections(),
    pump: emptyAssetPropertySections(),
    valve: emptyAssetPropertySections(),
    reservoir: emptyAssetPropertySections(),
    tank: emptyAssetPropertySections(),
  },
  counts: {
    junction: 0,
    pipe: 0,
    pump: 0,
    valve: 0,
    reservoir: 0,
    tank: 0,
  },
});

export const computeAssetsStats = (
  _assets: Asset[],
  _units: UnitsSpec,
  _formatting: FormattingSpec,
  _hydraulicModel: HydraulicModel,
  _simulationSettings: SimulationSettings,
  _simulationResults: ResultsReader | null,
): ComputedMultiAssetData => {
  return emptyComputedMultiAssetData();
};
