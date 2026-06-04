import type {
  Feature,
  FeatureCollection,
  Polygon,
  MultiPolygon,
} from "geojson";
import type { Proj4Projection } from "src/lib/projections";
import type { GisFiles } from "src/components/gis-drop-zone";
import { parseGeoJson } from "src/lib/geojson-utils/parse-geojson";
import { parseShapefile } from "src/lib/gis-import/parse-shapefile";
import { GisParseError } from "src/lib/gis-import/types";

export type ZoneFeature = Feature<Polygon | MultiPolygon>;

type ReadZoneFeaturesError =
  | "invalidFile"
  | "noPolygons"
  | "unsupportedProjection"
  | "invalidProjection";

type CoordinateConversion = {
  detected: string;
  converted: boolean;
  fromCRS: string;
};

export type ReadZoneFeaturesResult = {
  error?: ReadZoneFeaturesError;
  features: ZoneFeature[];
  uniqueProperties: Set<string>;
  coordinateConversion?: CoordinateConversion;
};

export const readZoneFeatures = async (
  gisFiles: GisFiles,
  projections?: Map<string, Proj4Projection> | null,
): Promise<ReadZoneFeaturesResult> => {
  if (gisFiles.geojson) {
    return readGeoJsonFile(gisFiles.geojson, projections);
  }

  if (gisFiles.shp && gisFiles.dbf && gisFiles.prj) {
    return readShapefiles(gisFiles);
  }

  return anError("invalidFile");
};

const readGeoJsonFile = async (
  file: File,
  projections?: Map<string, Proj4Projection> | null,
): Promise<ReadZoneFeaturesResult> => {
  let content: string;
  try {
    content = await file.text();
  } catch {
    return anError("invalidFile");
  }

  if (!isFeatureCollection(content)) {
    return anError("invalidFile");
  }

  let result;
  try {
    result = parseGeoJson(content, projections ?? undefined);
  } catch {
    return anError("invalidFile");
  }

  if (result.error) {
    if (
      result.error.code === "unsupported-crs" ||
      result.error.code === "projection-conversion-failed"
    ) {
      return anError("unsupportedProjection");
    }
    if (result.error.code === "invalid-projection") {
      return anError("invalidProjection");
    }
    return anError("invalidFile");
  }

  return extractZoneFeatures(result.features, result.coordinateConversion);
};

const readShapefiles = async (
  gisFiles: GisFiles,
): Promise<ReadZoneFeaturesResult> => {
  const files = [gisFiles.shp, gisFiles.dbf, gisFiles.prj, gisFiles.cpg].filter(
    (f): f is File => f != null,
  );

  let featureCollection: FeatureCollection;
  try {
    const result = await parseShapefile(files);
    featureCollection = result.featureCollection;
  } catch (err) {
    if (err instanceof GisParseError) {
      if (err.code === "missing-projection")
        return anError("unsupportedProjection");
      if (err.code === "unsupported-crs")
        return anError("unsupportedProjection");
      if (err.code === "invalid-projection")
        return anError("invalidProjection");
    }
    return anError("invalidFile");
  }

  return extractZoneFeatures(featureCollection.features);
};

const extractZoneFeatures = (
  rawFeatures: Feature[],
  coordinateConversion?: CoordinateConversion,
): ReadZoneFeaturesResult => {
  const features: ZoneFeature[] = [];
  const uniqueProperties = new Set<string>();

  for (const feature of rawFeatures) {
    if (isNotPolygon(feature)) continue;

    features.push(feature as ZoneFeature);

    if (feature.properties) {
      for (const key of Object.keys(feature.properties)) {
        uniqueProperties.add(key);
      }
    }
  }

  if (features.length === 0) {
    return anError("noPolygons");
  }

  return { features, uniqueProperties, coordinateConversion };
};

const isNotPolygon = (feature: Feature) =>
  feature.geometry?.type !== "Polygon" &&
  feature.geometry?.type !== "MultiPolygon";

const anError = (error: ReadZoneFeaturesError): ReadZoneFeaturesResult => ({
  error,
  features: [],
  uniqueProperties: new Set<string>(),
});

const isFeatureCollection = (content: string): boolean => {
  try {
    const data = JSON.parse(content);
    return (
      typeof data === "object" &&
      data !== null &&
      data.type === "FeatureCollection" &&
      Array.isArray(data.features)
    );
  } catch {
    return false;
  }
};
