import { FeatureCollection } from "geojson";
import { parseGeoJson } from "src/lib/geojson-utils/parse-geojson";
import type { Proj4Projection } from "src/lib/projections";

export type GisParseError =
  | "invalid-format"
  | "invalid-projection"
  | "unsupported-crs"
  | "projection-conversion-failed"
  | "no-features";

export type GisParseResult =
  | { ok: true; featureCollection: FeatureCollection; name: string }
  | { ok: false; error: GisParseError };

export async function parseGeoJsonFile(
  file: File,
  projections: Map<string, Proj4Projection> | null,
): Promise<GisParseResult> {
  let content: string;
  try {
    content = await file.text();
  } catch {
    return { ok: false, error: "invalid-format" };
  }

  let result;
  try {
    result = parseGeoJson(content, projections ?? undefined);
  } catch {
    return { ok: false, error: "invalid-format" };
  }

  if (result.error) {
    if (
      result.error.code === "unsupported-crs" ||
      result.error.code === "projection-conversion-failed"
    ) {
      return { ok: false, error: result.error.code };
    }
    if (result.error.code === "invalid-projection") {
      return { ok: false, error: "invalid-projection" };
    }
    return { ok: false, error: "invalid-format" };
  }

  if (!result.features.length) {
    return { ok: false, error: "no-features" };
  }

  const featureCollection: FeatureCollection = {
    type: "FeatureCollection",
    features: result.features,
  };

  const name = file.name.replace(/\.(geojson|json)$/i, "");

  return { ok: true, featureCollection, name };
}
