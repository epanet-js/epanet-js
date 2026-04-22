import { FeatureCollection } from "geojson";
import { parseGeoJson } from "src/lib/geojson-utils/parse-geojson";
import type { Proj4Projection } from "src/lib/projections";
import { GisParseError, type GisParseResult } from "./types";

export {
  GisParseError,
  type GisParseErrorCode,
  type GisParseResult,
} from "./types";

export async function parseGeoJsonFile(
  file: File,
  projections: Map<string, Proj4Projection> | null,
): Promise<GisParseResult> {
  let content: string;
  try {
    content = await file.text();
  } catch {
    throw new GisParseError(file.name, "invalid-format");
  }

  let result;
  try {
    result = parseGeoJson(content, projections ?? undefined);
  } catch {
    throw new GisParseError(file.name, "invalid-format");
  }

  if (result.error) {
    if (
      result.error.code === "unsupported-crs" ||
      result.error.code === "projection-conversion-failed"
    ) {
      throw new GisParseError(file.name, result.error.code);
    }
    if (result.error.code === "invalid-projection") {
      throw new GisParseError(file.name, "invalid-projection");
    }
    throw new GisParseError(file.name, "invalid-format");
  }

  if (!result.features.length) {
    throw new GisParseError(file.name, "no-features");
  }

  const featureCollection: FeatureCollection = {
    type: "FeatureCollection",
    features: result.features,
  };

  const name = file.name.replace(/\.(geojson|json)$/i, "");

  return { featureCollection, name, properties: [...result.properties] };
}
