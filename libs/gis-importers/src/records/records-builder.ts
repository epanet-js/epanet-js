import type { Feature, Position } from "geojson";
import {
  ColumnKind,
  GeometryKind,
  Presence,
  encodeRecords,
  type EncodedColumn,
} from "./codec";
import {
  growableFloat64,
  growableUint32,
  growableUint8,
  type Growable,
} from "./growable";

const POSITION_NUMBERS = 2;
const LINE_POSITIONS = 2;

const Cell = { Absent: 0, Null: 1, Number: 2, Text: 3, Json: 4 } as const;

class ColumnBuilder {
  private readonly cells = growableUint8();
  private readonly slots = growableUint32();
  private readonly numbers = growableFloat64();
  private readonly texts = new Map<string, number>();
  private readonly jsons = new Map<string, number>();
  private stated = { numbers: 0, texts: 0, jsons: 0 };

  constructor(readonly name: string) {}

  set(record: number, value: unknown): void {
    this.cells.fill(Cell.Absent, record);
    this.slots.fill(0, record);

    if (value === null) {
      this.cells.push(Cell.Null);
      this.slots.push(0);
    } else if (typeof value === "number") {
      this.stated.numbers += 1;
      this.cells.push(Cell.Number);
      this.slots.push(this.numbers.length);
      this.numbers.push(value);
    } else if (typeof value === "string") {
      this.stated.texts += 1;
      this.cells.push(Cell.Text);
      this.slots.push(slotOf(this.texts, value));
    } else {
      this.stated.jsons += 1;
      this.cells.push(Cell.Json);
      this.slots.push(slotOf(this.jsons, JSON.stringify(value)));
    }
  }

  encode(count: number): EncodedColumn {
    this.cells.fill(Cell.Absent, count);
    this.slots.fill(0, count);
    const cells = this.cells.view();
    const slots = this.slots.view();
    const presence = presenceOf(cells);
    const { numbers, texts, jsons } = this.stated;

    if (texts === 0 && jsons === 0) {
      const doubles = new Float64Array(count).fill(Number.NaN);
      for (let i = 0; i < count; i++) {
        if (cells[i] === Cell.Number) doubles[i] = this.numbers.get(slots[i]);
      }
      return { name: this.name, kind: ColumnKind.Doubles, doubles, presence };
    }

    if (numbers === 0 && jsons === 0) {
      return {
        name: this.name,
        kind: ColumnKind.Texts,
        dictionary: [...this.texts.keys()],
        indices: slots.slice(),
        presence,
      };
    }

    const textOf = [...this.texts.keys()];
    const jsonOf = [...this.jsons.keys()];
    const dictionary = new Map<string, number>();
    const indices = new Uint32Array(count);
    for (let i = 0; i < count; i++) {
      const cell = cells[i];
      if (cell === Cell.Number) {
        indices[i] = slotOf(
          dictionary,
          JSON.stringify(this.numbers.get(slots[i])),
        );
      } else if (cell === Cell.Text) {
        indices[i] = slotOf(dictionary, JSON.stringify(textOf[slots[i]]));
      } else if (cell === Cell.Json) {
        indices[i] = slotOf(dictionary, jsonOf[slots[i]]);
      }
    }
    return {
      name: this.name,
      kind: ColumnKind.Json,
      dictionary: [...dictionary.keys()],
      indices,
      presence,
    };
  }
}

const slotOf = (dictionary: Map<string, number>, value: string): number => {
  let slot = dictionary.get(value);
  if (slot === undefined) {
    slot = dictionary.size;
    dictionary.set(value, slot);
  }
  return slot;
};

const presenceOf = (cells: Uint8Array): Uint8Array | undefined => {
  let allPresent = true;
  const presence = new Uint8Array(cells.length);
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (cell === Cell.Absent) {
      presence[i] = Presence.Absent;
      allPresent = false;
    } else if (cell === Cell.Null) {
      presence[i] = Presence.Null;
      allPresent = false;
    }
  }
  return allPresent ? undefined : presence;
};

const isPosition = (position: Position): boolean =>
  Array.isArray(position) &&
  position.length >= POSITION_NUMBERS &&
  Number.isFinite(position[0]) &&
  Number.isFinite(position[1]);

const isLine = (positions: Position[]): boolean =>
  Array.isArray(positions) &&
  positions.length >= LINE_POSITIONS &&
  positions.every(isPosition);

const isRing = (ring: Position[]): boolean =>
  Array.isArray(ring) && ring.every(isPosition);

export class RecordsBuilder {
  count = 0;
  private readonly kinds = growableUint8();
  private readonly recordPolygons = growableUint32();
  private readonly polygonRings = growableUint32();
  private readonly ringPositions = growableUint32();
  private readonly xy = growableFloat64();
  private z: Growable<Float64Array> | null = null;
  private readonly columns = new Map<string, ColumnBuilder>();

  constructor() {
    this.recordPolygons.push(0);
    this.polygonRings.push(0);
    this.ringPositions.push(0);
  }

  /** Adds one record per single part; 0 means the feature had none usable. */
  addFeature(feature: Feature): number {
    const geometry = feature.geometry;
    const properties = feature.properties;

    switch (geometry?.type) {
      case "MultiPoint": {
        let parts = 0;
        for (const position of geometry.coordinates) {
          if (!isPosition(position)) continue;
          this.addPoint(position, properties);
          parts += 1;
        }
        return parts;
      }
      case "MultiLineString": {
        let parts = 0;
        for (const line of geometry.coordinates) {
          if (!isLine(line)) continue;
          this.addRings(GeometryKind.Line, [[line]], properties);
          parts += 1;
        }
        return parts;
      }
      case "Point":
        if (!isPosition(geometry.coordinates)) return 0;
        this.addPoint(geometry.coordinates, properties);
        return 1;
      case "LineString":
        if (!isLine(geometry.coordinates)) return 0;
        this.addRings(GeometryKind.Line, [[geometry.coordinates]], properties);
        return 1;
      case "Polygon":
        if (!geometry.coordinates.every(isRing)) return 0;
        this.addRings(GeometryKind.Polygon, [geometry.coordinates], properties);
        return 1;
      case "MultiPolygon":
        if (!geometry.coordinates.every((rings) => rings.every(isRing))) {
          return 0;
        }
        this.addRings(GeometryKind.Polygon, geometry.coordinates, properties);
        return 1;
      default:
        this.addRings(
          geometry ? GeometryKind.Unknown : GeometryKind.None,
          [],
          properties,
        );
        return 1;
    }
  }

  encode(): ArrayBuffer {
    return encodeRecords({
      count: this.count,
      kinds: this.kinds.view(),
      recordPolygons: this.recordPolygons.view(),
      polygonRings: this.polygonRings.view(),
      ringPositions: this.ringPositions.view(),
      xy: this.xy.view(),
      z: this.z?.view() ?? null,
      columns: [...this.columns.values()].map((column) =>
        column.encode(this.count),
      ),
    });
  }

  private addPoint(
    position: Position,
    properties: Feature["properties"],
  ): void {
    this.addRings(GeometryKind.Point, [[[position]]], properties);
  }

  private addRings(
    kind: GeometryKind,
    polygons: Position[][][],
    properties: Feature["properties"],
  ): void {
    for (const rings of polygons) {
      for (const ring of rings) {
        for (const position of ring) this.addPosition(position);
        this.ringPositions.push(this.xy.length / 2);
      }
      this.polygonRings.push(this.ringPositions.length - 1);
    }
    this.recordPolygons.push(this.polygonRings.length - 1);
    this.kinds.push(kind);
    this.addValues(properties);
    this.count += 1;
  }

  private addPosition(position: Position): void {
    const z = position.length > POSITION_NUMBERS ? position[2] : undefined;
    if (typeof z === "number" && this.z === null) {
      this.z = growableFloat64();
      this.z.fill(Number.NaN, this.xy.length / 2);
    }
    this.xy.push(position[0]);
    this.xy.push(position[1]);
    this.z?.push(typeof z === "number" ? z : Number.NaN);
  }

  private addValues(properties: Feature["properties"]): void {
    if (!properties) return;
    for (const name in properties) {
      const value: unknown = properties[name];
      if (value === undefined) continue;
      let column = this.columns.get(name);
      if (!column) {
        column = new ColumnBuilder(name);
        this.columns.set(name, column);
      }
      column.set(this.count, value);
    }
  }
}
