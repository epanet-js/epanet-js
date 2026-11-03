import type { Feature } from "geojson";
import type {
  RecordsContents,
  SourceAttribute,
  SourceContents,
  SourceGeometry,
} from "../importer";
import type { GisRecords } from "../records/gis-records";
import { numberOf } from "../number-value";
import { MAX_ENUM_VALUES, isBlank, valueKeyOf } from "../value-key";

const isNumeric = (value: unknown): boolean => numberOf(value) !== null;

type Tally = { stated: number; numeric: number; values: Set<string> | null };

const withValue = (
  values: Set<string> | null,
  key: string,
): Set<string> | null => {
  if (values === null || values.has(key)) return values;
  if (values.size === MAX_ENUM_VALUES) return null;
  values.add(key);
  return values;
};
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

const tallyValue = (tallies: Tallies, name: string, value: unknown): void => {
  if (isBlank(value)) return;

  const counts = tallies.get(name) ?? {
    stated: 0,
    numeric: 0,
    values: new Set<string>(),
  };
  counts.stated += 1;
  if (isNumeric(value)) counts.numeric += 1;
  counts.values = withValue(counts.values, valueKeyOf(value));
  tallies.set(name, counts);
};

const tally = (tallies: Tallies, feature: Feature): void => {
  const properties = feature.properties;
  if (!properties) return;

  for (const [name, value] of Object.entries(properties)) {
    tallyValue(tallies, name, value);
  }
};

const merged = (all: Iterable<Tallies>): Tallies => {
  const total: Tallies = new Map();
  for (const tallies of all) {
    for (const [name, { stated, numeric, values }] of tallies) {
      const counts = total.get(name) ?? {
        stated: 0,
        numeric: 0,
        values: new Set<string>(),
      };
      counts.stated += stated;
      counts.numeric += numeric;
      counts.values =
        values === null
          ? null
          : [...values].reduce<Set<string> | null>(
              withValue,
              counts.values && new Set(counts.values),
            );
      total.set(name, counts);
    }
  }
  return total;
};

const attributesOf = (
  tallies: Tallies,
  recordCount: number,
  statedOrder?: string[],
): SourceAttribute[] =>
  [...tallies.entries()]
    .map(([name, { stated, numeric, values }]): SourceAttribute => {
      const onEveryRecord = stated === recordCount;
      return {
        name,
        type: numeric === stated ? "number" : "text",
        onEveryRecord,
        ...(values !== null && {
          values: [...values],
        }),
      };
    })
    .sort(ordering(statedOrder));

const byName = (a: SourceAttribute, b: SourceAttribute): number =>
  a.name.localeCompare(b.name);

const ordering = (
  statedOrder?: string[],
): ((a: SourceAttribute, b: SourceAttribute) => number) => {
  if (statedOrder === undefined) return byName;

  const positions = new Map(statedOrder.map((name, index) => [name, index]));
  const positionOf = ({ name }: SourceAttribute): number =>
    positions.get(name) ?? statedOrder.length;

  return (a, b) => positionOf(a) - positionOf(b) || byName(a, b);
};

const NO_GEOMETRY = null;

export const contentsOf = (
  features: Feature[],
  statedOrder?: string[],
): SourceContents => {
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
    statedOrder,
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
                statedOrder,
              ),
            };
          }),
  };
};

export const recordsContentsOf = (
  records: GisRecords,
  statedOrder?: string[],
): RecordsContents => {
  const indicesByKind = new Map<SourceGeometry, number[]>();
  const talliesByKind = new Map<SourceGeometry | typeof NO_GEOMETRY, Tallies>();
  const tallies = new Array<Tallies>(records.count);

  for (let index = 0; index < records.count; index++) {
    const kind = records.kindOf(index);

    if (kind !== NO_GEOMETRY) {
      const indices = indicesByKind.get(kind);
      if (indices) indices.push(index);
      else indicesByKind.set(kind, [index]);
    }

    let kindTallies = talliesByKind.get(kind);
    if (!kindTallies) {
      kindTallies = new Map();
      talliesByKind.set(kind, kindTallies);
    }
    tallies[index] = kindTallies;
  }

  for (const name of records.attributes) {
    for (let index = 0; index < records.count; index++) {
      tallyValue(tallies[index], name, records.valueOf(index, name));
    }
  }

  const attributes = attributesOf(
    merged(talliesByKind.values()),
    records.count,
    statedOrder,
  );
  const geometries = GEOMETRY_ORDER.filter((kind) => indicesByKind.has(kind));

  return {
    attributes,
    recordCount: records.count,
    groups:
      geometries.length === 1
        ? [{ geometry: geometries[0], records, attributes }]
        : geometries.map((geometry) => {
            const indices = indicesByKind.get(geometry) as number[];
            return {
              geometry,
              records: records.select(indices),
              attributes: attributesOf(
                talliesByKind.get(geometry) ?? new Map<string, Tally>(),
                indices.length,
                statedOrder,
              ),
            };
          }),
  };
};
