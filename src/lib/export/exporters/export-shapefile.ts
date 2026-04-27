import shpwrite from "@mapbox/shp-write";
import { ExportedFile, ExportEntry } from "../types";
import { generateGeoJson } from "./generate-geojson";

export const exportShapefile = async (
  entry: ExportEntry,
): Promise<ExportedFile> => {
  const geojson = generateGeoJson(entry.data);
  const blob = (await shpwrite.zip(geojson, {
    folder: entry.name,
    outputType: "blob",
    compression: "DEFLATE",
  })) as Blob;

  return {
    fileName: `${entry.name}.zip`,
    extensions: [".zip"],
    mimeTypes: ["application/zip"],
    description: "Shapefile",
    blob,
  };
};
