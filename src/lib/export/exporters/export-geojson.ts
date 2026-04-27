import { FeatureCollection, Geometry, Point } from "geojson";
import { ExportedFile, ExportEntry } from "../types";

const emptyGeometry: Point = {
  type: "Point",
  coordinates: [],
};

const generateGeoJson = (entry: ExportEntry): string => {
  const featureCollection: FeatureCollection = {
    type: "FeatureCollection",
    features: [],
  };

  entry.data.forEach((item) => {
    const geometry =
      "geometry" in item ? (item.geometry as Geometry) : emptyGeometry;
    const properties = { ...item };
    if ("geometry" in properties) {
      delete properties.geometry;
    }

    featureCollection.features.push({
      type: "Feature",
      geometry,
      properties,
    });
  });

  return JSON.stringify(featureCollection);
};

export const exportGeoJson = (entry: ExportEntry): ExportedFile => ({
  fileName: `${entry.name}.geojson`,
  extensions: [".geojson"],
  mimeTypes: ["application/geo+json"],
  description: "GeoJSON",
  blob: new Blob([generateGeoJson(entry)], { type: "application/geo+json" }),
});
