import type {
  FeatureCollection,
  Feature,
  Polygon,
  MultiPolygon,
} from "geojson";

export type ZoneFeature = Feature<Polygon | MultiPolygon>;

type ReadZoneFeaturesError = "invalidFile" | "noPolygons";

export type ReadZoneFeaturesResult = {
  error?: ReadZoneFeaturesError;
  features: ZoneFeature[];
  uniqueProperties: Set<string>;
};

export const readZoneFeatures = async (
  file: File,
): Promise<ReadZoneFeaturesResult> => {
  let parsed: unknown;
  try {
    const text = await file.text();
    parsed = JSON.parse(text);
  } catch {
    return anError("invalidFile");
  }

  if (!isFeatureCollection(parsed)) {
    return anError("invalidFile");
  }

  const features: ZoneFeature[] = [];
  const uniqueProperties = new Set<string>();

  for (const feature of parsed.features) {
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

  return { features, uniqueProperties };
};

const isNotPolygon = (feature: Feature) =>
  feature.geometry?.type !== "Polygon" &&
  feature.geometry?.type !== "MultiPolygon";

const anError = (error: ReadZoneFeaturesError): ReadZoneFeaturesResult => ({
  error,
  features: [],
  uniqueProperties: new Set<string>(),
});

const isFeatureCollection = (data: unknown): data is FeatureCollection => {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    (data as { type: string }).type === "FeatureCollection" &&
    "features" in data &&
    Array.isArray((data as FeatureCollection).features)
  );
};
