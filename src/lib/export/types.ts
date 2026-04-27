export type ExportFormat = "geojson" | "shapefile" | "csv" | "xlsx";

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
