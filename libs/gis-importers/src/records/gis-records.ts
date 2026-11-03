import type { Feature, Geometry, Position } from "geojson";
import type { SourceGeometry } from "../importer";
import {
  ColumnKind,
  GeometryKind,
  Presence,
  decodeRecords,
  type DecodedColumn,
  type DecodedRecords,
} from "./codec";

export type RecordGeometry =
  | { type: "point"; position: Position }
  | { type: "line"; positions: Position[] }
  | { type: "polygon"; polygons: Position[][][] };

/** What crosses a worker boundary: the buffer, and which of its records. */
export type GisRecordsData = {
  bytes: ArrayBuffer;
  indices: Uint32Array | null;
};

type ColumnReader = (record: number) => unknown;

const CACHED_DICTIONARY_LIMIT = 65536;

const dictionaryReader = (
  column: DecodedColumn,
  parse: (entry: string) => unknown,
): ((index: number) => unknown) => {
  if (column.dictionaryLength > CACHED_DICTIONARY_LIMIT) {
    return (index) => parse(column.dictionaryAt(index));
  }
  const cache: unknown[] = new Array(column.dictionaryLength);
  const decoded = new Uint8Array(column.dictionaryLength);
  return (index) => {
    if (decoded[index] === 0) {
      cache[index] = parse(column.dictionaryAt(index));
      decoded[index] = 1;
    }
    return cache[index];
  };
};

const readerOf = (column: DecodedColumn): ColumnReader => {
  const presence = column.presence;
  const valueAt = ((): ColumnReader => {
    if (column.kind === ColumnKind.Doubles) {
      const doubles = column.doubles as Float64Array;
      return (record) => doubles[record];
    }
    const indices = column.indices as Uint32Array;
    const entry = dictionaryReader(
      column,
      column.kind === ColumnKind.Json
        ? (text) => JSON.parse(text) as unknown
        : (text) => text,
    );
    return (record) => entry(indices[record]);
  })();

  if (presence === null) return valueAt;
  return (record) => {
    const state = presence[record] as Presence;
    if (state === Presence.Absent) return undefined;
    if (state === Presence.Null) return null;
    return valueAt(record);
  };
};

class Table {
  readonly decoded: DecodedRecords;
  readonly attributes: string[];
  private readonly columns = new Map<string, DecodedColumn>();
  private readonly readers = new Map<string, ColumnReader>();

  constructor(readonly bytes: ArrayBuffer) {
    this.decoded = decodeRecords(bytes);
    for (const column of this.decoded.columns) {
      this.columns.set(column.name, column);
    }
    this.attributes = [...this.columns.keys()];
  }

  reader(attribute: string): ColumnReader | undefined {
    let reader = this.readers.get(attribute);
    if (reader) return reader;
    const column = this.columns.get(attribute);
    if (!column) return undefined;
    reader = readerOf(column);
    this.readers.set(attribute, reader);
    return reader;
  }
}

const tables = new WeakMap<ArrayBuffer, Table>();

const tableOf = (bytes: ArrayBuffer): Table => {
  let table = tables.get(bytes);
  if (!table) {
    table = new Table(bytes);
    tables.set(bytes, table);
  }
  return table;
};

const SOURCE_GEOMETRY: Record<number, SourceGeometry | null> = {
  [GeometryKind.None]: null,
  [GeometryKind.Point]: "point",
  [GeometryKind.Line]: "line",
  [GeometryKind.Polygon]: "polygon",
  [GeometryKind.Unknown]: "unknown",
};

export class GisRecords {
  private constructor(
    private readonly table: Table,
    private readonly indices: Uint32Array | null,
  ) {}

  static fromData({ bytes, indices }: GisRecordsData): GisRecords {
    return new GisRecords(tableOf(bytes), indices);
  }

  get data(): GisRecordsData {
    return { bytes: this.table.bytes, indices: this.indices };
  }

  get count(): number {
    return this.indices?.length ?? this.table.decoded.count;
  }

  get byteLength(): number {
    return this.table.bytes.byteLength + (this.indices?.byteLength ?? 0);
  }

  get attributes(): string[] {
    return this.table.attributes;
  }

  kindOf(index: number): SourceGeometry | null {
    return SOURCE_GEOMETRY[this.table.decoded.kinds[this.recordAt(index)]];
  }

  geometryOf(index: number): RecordGeometry | null {
    const record = this.recordAt(index);
    const kind = this.table.decoded.kinds[record] as GeometryKind;
    if (kind === GeometryKind.Point) {
      return { type: "point", position: this.polygonsOf(record)[0][0][0] };
    }
    if (kind === GeometryKind.Line) {
      return { type: "line", positions: this.polygonsOf(record)[0][0] };
    }
    if (kind === GeometryKind.Polygon) {
      return { type: "polygon", polygons: this.polygonsOf(record) };
    }
    return null;
  }

  toGeometry(index: number): Geometry | null {
    const geometry = this.geometryOf(index);
    if (geometry === null) return null;
    if (geometry.type === "point") {
      return { type: "Point", coordinates: geometry.position };
    }
    if (geometry.type === "line") {
      return { type: "LineString", coordinates: geometry.positions };
    }
    return geometry.polygons.length === 1
      ? { type: "Polygon", coordinates: geometry.polygons[0] }
      : { type: "MultiPolygon", coordinates: geometry.polygons };
  }

  valueOf(index: number, attribute: string): unknown {
    return this.table.reader(attribute)?.(this.recordAt(index));
  }

  propertiesOf(index: number): Record<string, unknown> {
    const record = this.recordAt(index);
    const properties: Record<string, unknown> = {};
    for (const attribute of this.table.attributes) {
      const value = this.table.reader(attribute)?.(record);
      if (value !== undefined) properties[attribute] = value;
    }
    return properties;
  }

  toFeature(index: number): Feature {
    return {
      type: "Feature",
      geometry: this.toGeometry(index) as Geometry,
      properties: this.propertiesOf(index),
    };
  }

  toFeatures(): Feature[] {
    return Array.from({ length: this.count }, (_, index) =>
      this.toFeature(index),
    );
  }

  /** The records at `indices`, which count within this selection. */
  select(indices: ArrayLike<number>): GisRecords {
    const selected = new Uint32Array(indices.length);
    for (let i = 0; i < indices.length; i++) {
      selected[i] = this.recordAt(indices[i]);
    }
    return new GisRecords(this.table, selected);
  }

  slice(start: number, end = this.count): GisRecords {
    const to = Math.min(end, this.count);
    const indices = new Uint32Array(Math.max(0, to - start));
    for (let i = 0; i < indices.length; i++) indices[i] = start + i;
    return this.select(indices);
  }

  private recordAt(index: number): number {
    return this.indices === null ? index : this.indices[index];
  }

  private polygonsOf(record: number): Position[][][] {
    const { recordPolygons, polygonRings, ringPositions, xy, z } =
      this.table.decoded;
    const polygons: Position[][][] = [];
    for (
      let polygon = recordPolygons[record];
      polygon < recordPolygons[record + 1];
      polygon++
    ) {
      const rings: Position[][] = [];
      for (
        let ring = polygonRings[polygon];
        ring < polygonRings[polygon + 1];
        ring++
      ) {
        const positions: Position[] = [];
        for (
          let position = ringPositions[ring];
          position < ringPositions[ring + 1];
          position++
        ) {
          const height = z?.[position];
          positions.push(
            height === undefined || Number.isNaN(height)
              ? [xy[position * 2], xy[position * 2 + 1]]
              : [xy[position * 2], xy[position * 2 + 1], height],
          );
        }
        rings.push(positions);
      }
      polygons.push(rings);
    }
    return polygons;
  }
}
