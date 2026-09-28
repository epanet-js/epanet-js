import type { Feature } from "geojson";
import type { Issue } from "@epanet-js/converters";
import Papa from "papaparse";
import type { CoordinateAttributes } from "../importer";
import { numberOf } from "../number-value";

type Row = Record<string, string>;

type ParsedCsv = {
  features: Feature[];
  skipped: Issue[];
};

export type CsvFailure = "sourceUnreadable" | "sourceHeaderMissing";

export const readCsv = (
  content: string,
  geometryAttributes?: CoordinateAttributes,
): ParsedCsv | CsvFailure => {
  const table = parseTable(content);
  if (table === null) return "sourceUnreadable";

  const { headers, rows } = table;
  if (!namesItsColumns(headers)) return "sourceHeaderMissing";

  const coordinatAttributes = checkGeometryAttributes(
    headers,
    geometryAttributes,
  );
  if (coordinatAttributes === null) return unplaced(rows);

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

  return features.length === 0 ? unplaced(rows) : { features, skipped };
};

const unplaced = (rows: Row[]): ParsedCsv => ({
  features: rows.map(withoutGeometry),
  skipped: [],
});

type Table = { headers: string[]; rows: Row[] };

const parseTable = (content: string): Table | null => {
  const parsed = Papa.parse<Row>(content, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });

  const headers = parsed.meta.fields ?? [];
  if (headers.length === 0 || headers.every((header) => header === "")) {
    return null;
  }

  return { headers, rows: parsed.data };
};

const namesItsColumns = (headers: string[]): boolean =>
  headers.every((header) => header === "" || /\p{L}/u.test(header));

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
