import type { Feature, Geometry, Position } from "geojson";

// Reads a shapefile bundle one record at a time, following shpjs and parsedbf
// so that a record comes back exactly as they would return it — but without
// ever holding the whole bundle as GeoJSON.

const SHAPE_FUNCTIONS: Record<number, (data: DataView) => Geometry | null> = {
  1: (data) => ({ type: "Point", coordinates: coordAt(data, 0) }),
  3: (data) => polyline(data),
  5: (data) => polygonOf(polyline(data)),
  8: (data) => multiPoint(data),
  11: (data) => ({
    type: "Point",
    coordinates: [...coordAt(data, 0), data.getFloat64(16, true)],
  }),
  13: (data) => zPolyline(data),
  15: (data) => polygonOf(zPolyline(data)),
  18: (data) => zMultiPoint(data),
};

const coordAt = (data: DataView, offset: number): Position => [
  data.getFloat64(offset, true),
  data.getFloat64(offset + 8, true),
];

const coordsAt = (data: DataView, offset: number, count: number) => {
  const out: Position[] = [];
  for (let i = 0; i < count; i++) out.push(coordAt(data, offset + i * 16));
  return out;
};

const withZ = (
  data: DataView,
  zOffset: number,
  coordinates: Position[],
): Position[] => {
  for (let i = 0; i < coordinates.length; i++) {
    coordinates[i].push(data.getFloat64(zOffset + i * 8, true));
  }
  return coordinates;
};

const multiPoint = (data: DataView): Geometry | null => {
  const count = data.getInt32(32, true);
  if (!count) return null;
  return count === 1
    ? { type: "Point", coordinates: coordAt(data, 36) }
    : { type: "MultiPoint", coordinates: coordsAt(data, 36, count) };
};

const zMultiPoint = (data: DataView): Geometry | null => {
  const geometry = multiPoint(data);
  if (!geometry) return null;
  if (geometry.type === "Point") {
    // shpjs reads 4 bytes past where the spec puts it; kept so both agree.
    geometry.coordinates.push(data.getFloat64(72, true));
    return geometry;
  }
  const points = (geometry as { coordinates: Position[] }).coordinates;
  withZ(data, 52 + (points.length << 4), points);
  return geometry;
};

const partGroups = (
  data: DataView,
  offset: number,
  partOffset: number,
  parts: number,
  total: number,
): Position[][] => {
  const out: Position[][] = [];
  let next = 0;
  for (let done = 1; done <= parts; done++) {
    partOffset += 4;
    const current = next;
    next = done === parts ? total : data.getInt32(partOffset, true);
    const count = next - current;
    if (!count) continue;
    out.push(coordsAt(data, offset, count));
    offset += count << 4;
  }
  return out;
};

type Polyline =
  | { type: "LineString"; coordinates: Position[] }
  | { type: "MultiLineString"; coordinates: Position[][] };

const polyline = (data: DataView): Polyline | null => {
  const parts = data.getInt32(32, true);
  if (!parts) return null;
  const count = data.getInt32(36, true);
  if (parts === 1) {
    return { type: "LineString", coordinates: coordsAt(data, 44, count) };
  }
  return {
    type: "MultiLineString",
    coordinates: partGroups(data, 40 + (parts << 2), 40, parts, count),
  };
};

const zPolyline = (data: DataView): Polyline | null => {
  const geometry = polyline(data);
  if (!geometry) return null;
  if (geometry.type === "LineString") {
    withZ(data, 60 + (geometry.coordinates.length << 4), geometry.coordinates);
    return geometry;
  }
  const parts = geometry.coordinates.length;
  const total = geometry.coordinates.reduce(
    (sum, line) => sum + line.length,
    0,
  );
  let zOffset = 56 + (total << 4) + (parts << 2);
  for (const line of geometry.coordinates) {
    withZ(data, zOffset, line);
    zOffset += line.length << 3;
  }
  return geometry;
};

type Ring = {
  ring: Position[];
  clockWise: boolean;
  bbox: [number, number, number, number];
  children: Position[][];
};

const ringOf = (ring: Position[]): Ring => {
  let sum = 0;
  const bbox: Ring["bbox"] = [ring[0][0], ring[0][1], ring[0][0], ring[0][1]];
  let previous = ring[0];
  for (let i = 1; i < ring.length; i++) {
    const current = ring[i];
    sum += (current[0] - previous[0]) * (current[1] + previous[1]);
    previous = current;
    if (current[0] < bbox[0]) bbox[0] = current[0];
    if (current[1] < bbox[1]) bbox[1] = current[1];
    if (current[0] > bbox[2]) bbox[2] = current[0];
    if (current[1] > bbox[3]) bbox[3] = current[1];
  }
  return { ring, clockWise: sum > 0, bbox, children: [] };
};

const contains = (outer: Ring, inner: Ring): boolean =>
  outer.bbox[0] <= inner.bbox[0] &&
  outer.bbox[1] <= inner.bbox[1] &&
  outer.bbox[2] >= inner.bbox[2] &&
  outer.bbox[3] >= inner.bbox[3];

const groupRings = (
  rings: Position[][],
  reversed = false,
): { polygons: Position[][][]; orphans: number } => {
  const outers: Ring[] = [];
  const inners: Ring[] = [];
  for (const ring of rings) {
    const processed = ringOf(ring);
    if (processed.clockWise !== reversed) outers.push(processed);
    else inners.push(processed);
  }

  let orphans = 0;
  for (const inner of inners) {
    let candidate: Ring | undefined;
    for (const outer of outers) {
      if (!contains(outer, inner)) continue;
      if (!candidate || contains(candidate, outer)) candidate = outer;
    }
    if (candidate) candidate.children.push(inner.ring);
    else orphans += 1;
  }

  if (orphans > 0 && !reversed) {
    const other = groupRings(rings, true);
    if (other.orphans === 0) {
      return {
        polygons: other.polygons.map((rings) =>
          rings.map((ring) => [...ring].reverse()),
        ),
        orphans: 0,
      };
    }
  }

  return {
    polygons: outers.map((outer) => [outer.ring, ...outer.children]),
    orphans,
  };
};

const polygonOf = (line: Polyline | null): Geometry | null => {
  if (!line) return null;
  if (line.type === "LineString") {
    return { type: "Polygon", coordinates: [line.coordinates] };
  }
  const { polygons } = groupRings(line.coordinates);
  return polygons.length === 1
    ? { type: "Polygon", coordinates: polygons[0] }
    : { type: "MultiPolygon", coordinates: polygons };
};

const SHAPE_TYPE_OFFSET = 32;
const HEADER_BYTES = 100;
const M_SHAPES = 20;

const readShapes = (
  shp: ArrayBuffer,
  onShape: (geometry: Geometry | null, index: number) => void,
): void => {
  const view = new DataView(shp);
  let code = view.getInt32(SHAPE_TYPE_OFFSET, true);
  if (code > M_SHAPES) code -= M_SHAPES;
  const parse = SHAPE_FUNCTIONS[code];
  if (!parse) throw new Error(`Unknown shape type ${code}`);

  let offset = HEADER_BYTES;
  let index = 0;
  while (offset <= view.byteLength - 8) {
    const length = view.getInt32(offset + 4) << 1;
    if (length === 0) {
      onShape(null, index++);
      offset += 8;
      continue;
    }
    if (offset + length + 8 > view.byteLength) break;
    const type = view.getInt32(offset + 8, true);
    onShape(
      type ? parse(new DataView(shp, offset + 12, length - 4)) : null,
      index++,
    );
    offset += 8 + length;
  }
};

const CODE_PAGE = /^(?:ANSI\s)?(\d+)$/m;

const decoderFor = (cpg: string | undefined): TextDecoder => {
  if (!cpg) return new TextDecoder();
  try {
    return new TextDecoder(cpg.trim());
  } catch {
    const page = CODE_PAGE.exec(cpg);
    if (page) {
      try {
        return new TextDecoder(`windows-${page[1]}`);
      } catch {
        return new TextDecoder();
      }
    }
    return new TextDecoder();
  }
};

type DbfField = { name: string; type: string; length: number };

const readDbf = (dbf: ArrayBuffer, cpg: string | undefined) => {
  const view = new DataView(dbf);
  const bytes = new Uint8Array(dbf);
  const decoder = decoderFor(cpg);
  const text = (from: number, length: number): string =>
    decoder
      .decode(bytes.subarray(from, from + length))
      .replace(/\0/g, "")
      .trim();

  const records = view.getUint32(4, true);
  const headerLength = view.getUint16(8, true) - 1;
  const recordLength = view.getUint16(10, true);

  const fields: DbfField[] = [];
  for (let offset = 32; offset < headerLength; offset += 32) {
    fields.push({
      name: text(offset, 11),
      type: String.fromCharCode(view.getUint8(offset + 11)),
      length: view.getUint8(offset + 16),
    });
    if (view.getUint8(offset + 32) === 13) break;
  }

  const firstRecord = ((fields.length + 1) << 5) + 2;

  return {
    records,
    rowAt: (index: number): Record<string, unknown> => {
      const row: Record<string, unknown> = {};
      let offset = firstRecord + index * recordLength;
      for (const field of fields) {
        row[field.name] = valueOf(text(offset, field.length), field.type);
        offset += field.length;
      }
      return row;
    },
  };
};

const valueOf = (text: string, type: string): unknown => {
  switch (type) {
    case "N":
    case "F":
    case "O": {
      if (text === "") return null;
      const number = parseFloat(text);
      return Number.isNaN(number) ? text : number;
    }
    // Unlike shpjs, a date stays the calendar date it states: a local-midnight
    // Date becomes the day before once stored in UTC east of Greenwich.
    case "D":
      return /^\d{8}$/.test(text)
        ? `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`
        : null;
    case "L":
      return text.toLowerCase() === "y" || text.toLowerCase() === "t";
    default:
      return text;
  }
};

export type ShapefileBundle = {
  shp: ArrayBuffer;
  dbf?: ArrayBuffer;
  cpg?: string;
};

/** Hands each record to `onFeature` and keeps none of them; false when the
 *  bundle cannot be read. */
export const readShapefile = (
  { shp, dbf, cpg }: ShapefileBundle,
  onFeature: (feature: Feature) => void,
): boolean => {
  try {
    const table = dbf ? readDbf(dbf, cpg) : null;
    readShapes(shp, (geometry, index) => {
      onFeature({
        type: "Feature",
        geometry: geometry as Geometry,
        properties: table && index < table.records ? table.rowAt(index) : {},
      });
    });
    return true;
  } catch {
    return false;
  }
};
