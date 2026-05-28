import type { Feature, Polygon, MultiPolygon } from "geojson";
import type { Proj4Projection } from "src/lib/projections";
import { parseGeoJson } from "src/lib/geojson-utils/parse-geojson";

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

  const features: ZoneFeature[] = [];
  const uniqueProperties = new Set<string>();

  for (const feature of result.features) {
    if (isNotPolygon(feature)) {
      continue;
    }

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

  return {
    features,
    uniqueProperties,
    coordinateConversion: result.coordinateConversion,
  };
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
