import { ExportedFile, ExportEntry } from "../types";
import { generateGeoJson } from "./generate-geojson";

const toGeoJsonString = (entry: ExportEntry) => {
  const geojson = generateGeoJson(entry.data);
  return JSON.stringify(geojson);
};

export const exportGeoJson = (entry: ExportEntry): ExportedFile => ({
  fileName: `${entry.name}.geojson`,
  extensions: [".geojson"],
  mimeTypes: ["application/geo+json"],
  description: "GeoJSON",
  blob: new Blob([toGeoJsonString(entry)], { type: "application/geo+json" }),
});
