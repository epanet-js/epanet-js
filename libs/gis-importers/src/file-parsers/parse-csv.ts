import type { Feature } from "geojson";
import type { Issue } from "@epanet-js/converters";
import Papa from "papaparse";
import type { CoordinateAttributes } from "../importer";
import { numberOf } from "../number-value";

type Row = Record<string, string>;

type ParsedCsv = {
  features: Feature[];
  headers: string[];
  skipped: Issue[];
};

export type CsvFailure = "sourceUnreadable" | "sourceHeaderMissing";

export const readCsv = (
  content: string,
  geometryAttributes?: CoordinateAttributes,
): ParsedCsv | CsvFailure => {
  const table = parseTable(content);
  if (table === null) return "sourceUnreadable";

  const { headers, statedHeaders: stated, rows } = table;
  if (!namesItsColumns(stated)) return "sourceHeaderMissing";

  const coordinatAttributes = checkGeometryAttributes(
    headers,
    geometryAttributes,
  );
  if (coordinatAttributes === null) return unplaced(headers, rows);

  const features: Feature[] = [];
  const skipped: Issue[] = [];

  rows.forEach((row, index) => {
    const position = positionOf(row, coordinatAttributes);
    if (position === null) {
      skipped.push({
        code: "featureCoordinatesInvalid",
        severity: "warning",
        ref: String(index),
        raw: row,
      });
      return;
    }

    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: position },
      properties: { ...row },
    });
  });

  return features.length === 0
    ? unplaced(headers, rows)
    : { features, headers, skipped };
};

const unplaced = (headers: string[], rows: Row[]): ParsedCsv => ({
  features: rows.map(withoutGeometry),
  headers,
  skipped: [],
});

type Columns = { headers: string[]; rows: Row[] };

type Table = Columns & { statedHeaders: string[] };

const parseTable = (content: string): Table | null => {
  const stated: string[] = [];

  const parsed = Papa.parse<Row>(content, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header, index) => {
      if (stated[index] === undefined) stated[index] = header.trim();
      return stated[index] === "" ? columnName(index) : stated[index];
    },
  });

  if (stated.every((header) => header === "")) return null;

  return {
    statedHeaders: stated,
    ...named({ headers: parsed.meta.fields ?? [], rows: parsed.data }),
  };
};

const columnName = (index: number): string => `#${index + 1}`;

const UNNAMED_VALUES = "__parsed_extra";

const named = ({ headers, rows }: Columns): Columns => {
  let unnamed = 0;
  for (const row of rows) {
    unnamed = Math.max(unnamed, extraValuesOf(row).length);
  }
  if (unnamed === 0) return { headers, rows };

  const taken = new Set(headers);
  const names = Array.from({ length: unnamed }, (_, index) => {
    const name = unusedName(columnName(headers.length + index), taken);
    taken.add(name);
    return name;
  });

  return {
    headers: [...headers, ...names],
    rows: rows.map((row) => withNamedValues(row, names)),
  };
};

const unusedName = (base: string, taken: Set<string>): string => {
  let name = base;
  let attempt = 2;
  while (taken.has(name)) name = `${base} (${attempt++})`;
  return name;
};

const extraValuesOf = (row: Row): string[] => {
  const values: unknown = row[UNNAMED_VALUES];
  return Array.isArray(values) ? (values as string[]) : [];
};

const withNamedValues = (row: Row, names: string[]): Row => {
  const { [UNNAMED_VALUES]: unnamed, ...rest } = row;
  void unnamed;
  const values = extraValuesOf(row);

  names.forEach((name, index) => {
    const value = values[index];
    if (value !== undefined) rest[name] = value;
  });

  return rest;
};

const namesItsColumns = (stated: string[]): boolean =>
  stated.every((header) => header === "" || /\p{L}/u.test(header));

const positionOf = (
  row: Row,
  { x, y }: CoordinateAttributes,
): [number, number] | null => {
  const longitude = numberOf(row[x]);
  const latitude = numberOf(row[y]);

  return longitude === null || latitude === null ? null : [longitude, latitude];
};

const withoutGeometry = (row: Row): Feature =>
  ({
    type: "Feature",
    geometry: null,
    properties: { ...row },
  }) as unknown as Feature;

const checkGeometryAttributes = (
  headers: string[],
  geometryAttributes?: CoordinateAttributes,
): CoordinateAttributes | null =>
  geometryAttributes !== undefined &&
  headers.includes(geometryAttributes.x) &&
  headers.includes(geometryAttributes.y)
    ? geometryAttributes
    : null;
