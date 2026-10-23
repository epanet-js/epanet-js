import { AssetType } from "src/hydraulic-model";
import { ResultsReader } from "src/simulation";

export type ExportFormat = "geojson" | "csv" | "shapefile" | "xlsx";
export type ExportedAssetTypes = AssetType | "customerPoint";

export type ExportEntry = {
  format: ExportFormat;
  name: string;
  data: object[];
};

export type ExportedFile = {
  fileName: string;
  extensions: string[];
  mimeTypes: string[];
  description: string;
  blob: Blob;
};

export type ExportSimulationResultsProperties =
  | "status"
  | "flow"
  | "velocity"
  | "unitHeadloss"
  | "pressure"
  | "head"
  | "demand"
  | "waterQuality";

export const NODE_METRICS: ExportSimulationResultsProperties[] = [
  "pressure",
  "head",
  "demand",
  "waterQuality",
];

export const LINK_METRICS: ExportSimulationResultsProperties[] = [
  "flow",
  "velocity",
  "unitHeadloss",
  "status",
  "waterQuality",
];

export const combineMetrics = (
  nodeProperties: ExportSimulationResultsProperties[],
  linkProperties: ExportSimulationResultsProperties[],
): ExportSimulationResultsProperties[] =>
  Array.from(new Set([...nodeProperties, ...linkProperties]));

export type AssetExportOptions = {
  includeSimulationResults?: boolean;
  assetIdsFilter?: Set<number> | null;
  customerPointIdFilter?: Set<number> | null;
  resultsReader?: ResultsReader;
};

export type SimulationResultsOptions = {
  selectedAssets?: Set<number>;
  nodeProperties: ExportSimulationResultsProperties[];
  linkProperties: ExportSimulationResultsProperties[];
  onProgress?: (
    progressPercentage: number,
    property: ExportSimulationResultsProperties,
  ) => Promise<void>;
  signal?: AbortSignal;
};
