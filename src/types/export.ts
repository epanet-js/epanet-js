// Minimal replacement types for removed convert system

export interface ExportOptions {
  type: "inp";
  folderId: string | null;
}

export interface ConvertResult {
  features: any[];
  notes?: string[];
}

export interface GeoJSONResult {
  type: "geojson";
  notes: string[];
  geojson?: import("src/types").FeatureCollection;
}
