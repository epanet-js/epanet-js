import type { Feature, Polygon, MultiPolygon } from "geojson";
import type { Proj4Projection } from "src/lib/projections";
import type { GisFiles } from "src/components/gis-drop-zone";
import {
  parseGeoJson,
  type GeoJsonValidationErrorCode,
} from "src/lib/geojson-utils/parse-geojson";
import { parseShapefile } from "src/lib/gis-import/parse-shapefile";
import {
  GisParseError,
  GisParseErrorCode,
  type CoordinateConversion,
} from "src/lib/gis-import/types";

export type ZoneFeature = Feature<Polygon | MultiPolygon>;

type ReadZoneFeaturesError =
  | "invalidFile"
  | "noPolygons"
  | "unsupportedProjection"
  | "invalidProjection";

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
    return anError(geojsonErrorMapping[result.error.code]);
  }

  return extractZoneFeatures(result.features, result.coordinateConversion);
};

const readShapefiles = async (
  gisFiles: GisFiles,
): Promise<ReadZoneFeaturesResult> => {
  const files = [gisFiles.shp, gisFiles.dbf, gisFiles.prj, gisFiles.cpg].filter(
    (f): f is File => f != null,
  );

  try {
    const result = await parseShapefile(files);
    return extractZoneFeatures(
      result.featureCollection.features,
      result.coordinateConversion,
    );
  } catch (err) {
    if (err instanceof GisParseError) {
      return anError(shapefileErrorMapping[err.code]);
    }
    return anError("invalidFile");
  }
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
        if (!isEmptyValue(feature.properties[key])) {
          uniqueProperties.add(key);
        }
      }
    }
  }

  if (features.length === 0) {
    return anError("noPolygons");
  }

  const sortedProperties = new Set(
    [...uniqueProperties].sort((a, b) => a.localeCompare(b)),
  );

  return { features, uniqueProperties: sortedProperties, coordinateConversion };
};

const geojsonErrorMapping: Record<
  GeoJsonValidationErrorCode,
  ReadZoneFeaturesError
> = {
  "invalid-projection": "invalidProjection",
  "coordinates-missing": "invalidFile",
  "geometry-collection-not-supported": "invalidFile",
  "invalid-coordinate-format": "invalidFile",
  "coordinates-not-numbers": "invalidFile",
  "projection-conversion-failed": "unsupportedProjection",
  "unsupported-crs": "unsupportedProjection",
};

const shapefileErrorMapping: Record<GisParseErrorCode, ReadZoneFeaturesError> =
  {
    "invalid-format": "invalidFile",
    "invalid-projection": "invalidProjection",
    "missing-projection": "invalidProjection",
    "unsupported-crs": "unsupportedProjection",
    "projection-conversion-failed": "unsupportedProjection",
    "no-features": "invalidFile",
  };

const isEmptyValue = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  (typeof value === "string" && value.replace(/[\s\0]+/g, "") === "");

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
