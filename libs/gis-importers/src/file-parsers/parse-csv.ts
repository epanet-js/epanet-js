import type { Feature } from "geojson";
import type { Issue } from "@epanet-js/converters";
import Papa from "papaparse";
import type { CoordinateAttributes } from "../importer";

type Row = Record<string, string>;

type ParsedCsv = {
  features: Feature[];
  /** Null when no attribute named a coordinate the records could be read
   *  from; the features then carry their attributes and no geometry. */
  attributes: CoordinateAttributes | null;
  /** Records left out because their coordinates could not be read. */
  skipped: Issue[];
};

export const readCsv = (
  content: string,
  supplied?: CoordinateAttributes,
): ParsedCsv | null => {
  const table = parseTable(content);
  if (table === null) return null;

  const { headers, rows } = table;
  const attributes = chosenAttributes(headers, supplied);
  if (attributes === null) return unplaced(rows);

  const features: Feature[] = [];
  const skipped: Issue[] = [];

  rows.forEach((row, index) => {
    const position = positionOf(row, attributes);
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
    ? unplaced(rows)
    : { features, attributes, skipped };
};

/** Every record as its attributes alone, for a caller that has to name the
 *  coordinates before anything can be placed. */
const unplaced = (rows: Row[]): ParsedCsv => ({
  features: rows.map(withoutGeometry),
  attributes: null,
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

const positionOf = (
  row: Row,
  { x, y }: CoordinateAttributes,
): [number, number] | null => {
  const longitude = coordinateOf(row[x]);
  const latitude = coordinateOf(row[y]);

  return longitude === null || latitude === null ? null : [longitude, latitude];
};

const withoutGeometry = (row: Row): Feature =>
  ({
    type: "Feature",
    geometry: null,
    properties: { ...row },
  }) as unknown as Feature;

/** Reads a decimal number, taking a comma for the decimal point when a
 *  semicolon or tab separated the columns. */
const coordinateOf = (value: string | undefined): number | null => {
  const text = value?.trim();
  if (!text) return null;

  const number = Number(
    /^[+-]?\d+,\d+$/.test(text) ? text.replace(",", ".") : text,
  );
  return Number.isFinite(number) ? number : null;
};

const chosenAttributes = (
  headers: string[],
  supplied?: CoordinateAttributes,
): CoordinateAttributes | null => {
  if (supplied === undefined) return detectedAttributes(headers);

  return headers.includes(supplied.x) && headers.includes(supplied.y)
    ? supplied
    : null;
};

/** The names a family's coordinate is written under, bare or decorated
 *  ("POINT_X", "x_coord", "Centroid X"). */
type NameFamily = { x: string[]; y: string[] };

const FAMILIES: NameFamily[] = [
  { x: ["lon", "lng", "long", "longitude"], y: ["lat", "latitude"] },
  { x: ["easting", "east"], y: ["northing", "north"] },
  { x: ["x"], y: ["y"] },
];

const DECORATIONS = [
  "point",
  "coord",
  "coords",
  "coordinate",
  "centroid",
  "geo",
  "geom",
  "geometry",
  "utm",
  "wgs",
  "wgs84",
];

const normalized = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]/g, "");

const bareName = (name: string): string => {
  const text = normalized(name);

  for (const decoration of DECORATIONS) {
    if (text.startsWith(decoration)) return text.slice(decoration.length);
    if (text.endsWith(decoration)) {
      return text.slice(0, text.length - decoration.length);
    }
  }

  return text;
};

const detectedAttributes = (headers: string[]): CoordinateAttributes | null => {
  for (const family of FAMILIES) {
    const x = headerNamed(headers, family.x);
    const y = headerNamed(headers, family.y);
    if (x !== null && y !== null) return { x, y };
  }

  return null;
};

const headerNamed = (headers: string[], names: string[]): string | null => {
  const named = (matches: (header: string) => boolean) =>
    headers.find(matches) ?? null;

  return (
    named((header) => names.includes(normalized(header))) ??
    named((header) => names.includes(bareName(header)))
  );
};
