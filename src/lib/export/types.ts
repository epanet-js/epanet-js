export type ExportFormat = "geojson" | "shapefile" | "csv" | "xlsx";

export type ExportedFile = {
  name: string;
  data: object;
};
