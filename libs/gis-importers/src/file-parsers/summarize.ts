import type { Feature } from "geojson";
import type {
  SourceAttribute,
  SourceGeometry,
  SourceSummary,
} from "../importer";

const isBlank = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  (typeof value === "string" && value.replace(/[\s\0]+/g, "") === "") ||
  (typeof value === "number" && Number.isNaN(value));

const isNumeric = (value: unknown): boolean =>
  typeof value === "number"
    ? Number.isFinite(value)
    : typeof value === "string" && value.trim() !== "" && !isNaN(Number(value));

type Tally = { stated: number; numeric: number };

export const summarizeFeatures = (
  features: Feature[],
  originalProjection?: string,
): SourceSummary => {
  const tallies = new Map<string, Tally>();

  for (const feature of features) {
    const properties = feature.properties;
    if (!properties) continue;

    for (const [name, value] of Object.entries(properties)) {
      if (isBlank(value)) continue;

      const tally = tallies.get(name) ?? { stated: 0, numeric: 0 };
      tally.stated += 1;
      if (isNumeric(value)) tally.numeric += 1;
      tallies.set(name, tally);
    }
  }

  const attributes: SourceAttribute[] = [...tallies.entries()]
    .map(([name, { stated, numeric }]) => ({
      name,
      type: numeric === stated ? ("number" as const) : ("text" as const),
      onEveryRecord: stated === features.length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    attributes,
    recordCount: features.length,
    ...(originalProjection === undefined ? {} : { originalProjection }),
    geometry: geometryOf(features),
  };
};

const geometryOf = (features: Feature[]): SourceGeometry => {
  const kinds = new Set<SourceGeometry>();

  for (const feature of features) {
    const type = feature.geometry?.type;
    if (!type) continue;
    if (type === "Point" || type === "MultiPoint") kinds.add("point");
    else if (type === "LineString" || type === "MultiLineString")
      kinds.add("line");
    else if (type === "Polygon" || type === "MultiPolygon")
      kinds.add("polygon");
    else kinds.add("unknown");
  }

  if (kinds.size === 0) return "unknown";
  if (kinds.size > 1) return "mixed";
  return [...kinds][0];
};
