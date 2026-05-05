import { AssetType } from "src/hydraulic-model";

export type ExportFormat = "geojson" | "csv" | "shapefile";
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
