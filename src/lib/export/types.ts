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

export type ExportTimeSeriesMetrics =
  | "status"
  | "flow"
  | "velocity"
  | "unitHeadloss"
  | "pressure"
  | "head"
  | "demand"
  | "waterQuality";

export const ALL_METRICS: ExportTimeSeriesMetrics[] = [
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
  metrics?: ExportTimeSeriesMetrics[];
  onProgress?: (progressPercentage: number) => Promise<void>;
  signal?: AbortSignal;
};
