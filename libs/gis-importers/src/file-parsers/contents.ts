import type { Feature } from "geojson";
import type {
  SourceAttribute,
  SourceContents,
  SourceGeometry,
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

const GEOMETRY_ORDER: SourceGeometry[] = [
  "point",
  "line",
  "polygon",
  "unknown",
];

const geometryKindOf = (type: string): SourceGeometry => {
  if (type === "Point" || type === "MultiPoint") return "point";
  if (type === "LineString" || type === "MultiLineString") return "line";
  if (type === "Polygon" || type === "MultiPolygon") return "polygon";
  return "unknown";
};

export const contentsOf = (features: Feature[]): SourceContents => {
  const tallies = new Map<string, Tally>();
  const byKind = new Map<SourceGeometry, Feature[]>();

  for (const feature of features) {
    const type = feature.geometry?.type;
    if (type) {
      const kind = geometryKindOf(type);
      const group = byKind.get(kind);
      if (group) group.push(feature);
      else byKind.set(kind, [feature]);
    }

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

  const geometries = GEOMETRY_ORDER.filter((kind) => byKind.has(kind));

  return {
    attributes,
    recordCount: features.length,
    groups: geometries.map((geometry) => ({
      geometry,
      features:
        geometries.length === 1
          ? features
          : (byKind.get(geometry) as Feature[]),
    })),
  };
};
