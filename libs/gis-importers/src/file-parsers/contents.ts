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
type Tallies = Map<string, Tally>;

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

const tally = (tallies: Tallies, feature: Feature): void => {
  const properties = feature.properties;
  if (!properties) return;

  for (const [name, value] of Object.entries(properties)) {
    if (isBlank(value)) continue;

    const counts = tallies.get(name) ?? { stated: 0, numeric: 0 };
    counts.stated += 1;
    if (isNumeric(value)) counts.numeric += 1;
    tallies.set(name, counts);
  }
};

const merged = (all: Iterable<Tallies>): Tallies => {
  const total: Tallies = new Map();
  for (const tallies of all) {
    for (const [name, { stated, numeric }] of tallies) {
      const counts = total.get(name) ?? { stated: 0, numeric: 0 };
      counts.stated += stated;
      counts.numeric += numeric;
      total.set(name, counts);
    }
  }
  return total;
};

const attributesOf = (
  tallies: Tallies,
  recordCount: number,
): SourceAttribute[] =>
  [...tallies.entries()]
    .map(([name, { stated, numeric }]) => ({
      name,
      type: numeric === stated ? ("number" as const) : ("text" as const),
      onEveryRecord: stated === recordCount,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

const NO_GEOMETRY = null;

export const contentsOf = (features: Feature[]): SourceContents => {
  const byKind = new Map<SourceGeometry, Feature[]>();
  const talliesByKind = new Map<SourceGeometry | typeof NO_GEOMETRY, Tallies>();

  for (const feature of features) {
    const type = feature.geometry?.type;
    const kind = type === undefined ? NO_GEOMETRY : geometryKindOf(type);

    if (kind !== NO_GEOMETRY) {
      const group = byKind.get(kind);
      if (group) group.push(feature);
      else byKind.set(kind, [feature]);
    }

    let tallies = talliesByKind.get(kind);
    if (!tallies) {
      tallies = new Map();
      talliesByKind.set(kind, tallies);
    }
    tally(tallies, feature);
  }

  const attributes = attributesOf(
    merged(talliesByKind.values()),
    features.length,
  );
  const geometries = GEOMETRY_ORDER.filter((kind) => byKind.has(kind));

  return {
    attributes,
    recordCount: features.length,
    groups:
      geometries.length === 1
        ? [{ geometry: geometries[0], features, attributes }]
        : geometries.map((geometry) => {
            const held = byKind.get(geometry) as Feature[];
            return {
              geometry,
              features: held,
              attributes: attributesOf(
                talliesByKind.get(geometry) ?? new Map<string, Tally>(),
                held.length,
              ),
            };
          }),
  };
};
