import { Feature } from "geojson";

type GeoJsonValidationErrorCode =
  | "invalid-projection"
  | "coordinates-missing"
  | "geometry-collection-not-supported"
  | "invalid-coordinate-format"
  | "coordinates-not-numbers";

type GeoJsonValidationError = {
  code: GeoJsonValidationErrorCode;
  feature?: Feature;
};

export function parseGeoJson(content: string): {
  features: Feature[];
  properties: Set<string>;
  error?: GeoJsonValidationError;
} {
  const trimmedContent = content.trim();

  if (trimmedContent.startsWith("{")) {
    const result = parseGeoJsonFeatureCollection(trimmedContent);
    if (result) {
      return result;
    }
  }

  const result = parseGeoJsonL(trimmedContent);

  // If we have no features and the content looks like it should be JSON,
  // it's likely invalid JSON rather than empty valid JSON
  if (
    result.features.length === 0 &&
    !result.error &&
    trimmedContent.startsWith("{")
  ) {
    throw new Error("Invalid JSON format");
  }

  return result;
}

const parseGeoJsonFeatureCollection = (
  content: string,
): {
  features: Feature[];
  properties: Set<string>;
  error?: GeoJsonValidationError;
} | null => {
  let geoJson;
  try {
    geoJson = JSON.parse(content);
  } catch (error) {
    return null;
  }

  if (geoJson.type === "FeatureCollection" && geoJson.features) {
    const features: Feature[] = [];
    const properties = new Set<string>();

    for (const feature of geoJson.features) {
      const validationError = validateFeatureCoordinates(feature);
      if (validationError) {
        return {
          features: [],
          properties: new Set(),
          error: { code: validationError, feature },
        };
      }
      features.push(feature);
      if (feature.properties) {
        Object.keys(feature.properties).forEach((key) => properties.add(key));
      }
    }
    return { features, properties };
  }

  return null;
};

const parseGeoJsonL = (
  content: string,
): {
  features: Feature[];
  properties: Set<string>;
  error?: GeoJsonValidationError;
} => {
  const features: Feature[] = [];
  const properties = new Set<string>();

  const lines = content.split("\n").filter((line) => line.trim());
  for (const line of lines) {
    let json;
    try {
      json = JSON.parse(line);
    } catch (error) {
      continue;
    }

    if (json.type === "metadata") {
      continue;
    }
    if (json.type === "Feature") {
      const validationError = validateFeatureCoordinates(json);
      if (validationError) {
        return {
          features: [],
          properties: new Set(),
          error: { code: validationError, feature: json },
        };
      }
      features.push(json);
      if (json.properties) {
        Object.keys(json.properties).forEach((key) => properties.add(key));
      }
    }
  }

  return { features, properties };
};

const isWgs84 = (longitude: number, latitude: number): boolean => {
  return (
    longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90
  );
};

const validateCoordPair = (
  coord: [number, number],
): GeoJsonValidationErrorCode | null => {
  if (!Array.isArray(coord) || coord.length < 2) {
    return "invalid-coordinate-format";
  }

  const [longitude, latitude] = coord;

  if (typeof longitude !== "number" || typeof latitude !== "number") {
    return "coordinates-not-numbers";
  }

  return !isWgs84(longitude, latitude) ? "invalid-projection" : null;
};

const validateFeatureCoordinates = (
  feature: Feature,
): GeoJsonValidationErrorCode | null => {
  if (!feature.geometry) {
    return "coordinates-missing";
  }

  if (feature.geometry.type === "GeometryCollection") {
    return "geometry-collection-not-supported";
  }

  const { coordinates } = feature.geometry;

  switch (feature.geometry.type) {
    case "Point":
      return validateCoordPair(coordinates as [number, number]);

    case "LineString":
    case "MultiPoint":
      for (const coord of coordinates as [number, number][]) {
        const error = validateCoordPair(coord);
        if (error) return error;
      }
      break;

    case "Polygon":
    case "MultiLineString":
      for (const ring of coordinates as [number, number][][]) {
        for (const coord of ring) {
          const error = validateCoordPair(coord);
          if (error) return error;
        }
      }
      break;

    case "MultiPolygon":
      for (const polygon of coordinates as [number, number][][][]) {
        for (const ring of polygon) {
          for (const coord of ring) {
            const error = validateCoordPair(coord);
            if (error) return error;
          }
        }
      }
      break;
  }

  return null;
};
