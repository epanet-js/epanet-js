import { AssetType } from "src/hydraulic-model";

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

export const ALL_METRICS: ExportSimulationResultsProperties[] = [
  "pressure",
  "head",
  "demand",
  "waterQuality",
  "flow",
  "velocity",
  "unitHeadloss",
  "status",
];

export type SimulationResultsOptions = {
  selectedAssets?: Set<number>;
  properties?: ExportSimulationResultsProperties[];
  onProgress?: (progressPercentage: number) => Promise<void>;
  signal?: AbortSignal;
};
