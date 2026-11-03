import * as flatbuffers from "flatbuffers";
import { Column } from "./generated/gis-records-fb/column";
import { ColumnKind } from "./generated/gis-records-fb/column-kind";
import { Records } from "./generated/gis-records-fb/records";

export { ColumnKind } from "./generated/gis-records-fb/column-kind";
export { GeometryKind } from "./generated/gis-records-fb/geometry-kind";
export { Presence } from "./generated/gis-records-fb/presence";

export type EncodedColumn = {
  name: string;
  kind: ColumnKind;
  doubles?: Float64Array;
  dictionary?: string[];
  indices?: Uint32Array;
  presence?: Uint8Array;
};

export type EncodedRecords = {
  count: number;
  kinds: Uint8Array;
  recordPolygons: Uint32Array;
  polygonRings: Uint32Array;
  ringPositions: Uint32Array;
  xy: Float64Array;
  z: Float64Array | null;
  columns: EncodedColumn[];
};

const encodeColumn = (
  builder: flatbuffers.Builder,
  column: EncodedColumn,
): flatbuffers.Offset => {
  const name = builder.createString(column.name);
  const doubles = column.doubles
    ? Column.createDoublesVector(builder, column.doubles)
    : 0;
  const dictionary = column.dictionary
    ? Column.createDictionaryVector(
        builder,
        column.dictionary.map((entry) => builder.createString(entry)),
      )
    : 0;
  const indices = column.indices
    ? Column.createIndicesVector(builder, column.indices)
    : 0;
  const presence = column.presence
    ? Column.createPresenceVector(builder, column.presence)
    : 0;

  return Column.createColumn(
    builder,
    name,
    column.kind,
    doubles,
    dictionary,
    indices,
    presence,
  );
};

const estimatedSize = (records: EncodedRecords): number =>
  1024 +
  records.kinds.byteLength +
  records.recordPolygons.byteLength +
  records.polygonRings.byteLength +
  records.ringPositions.byteLength +
  records.xy.byteLength +
  (records.z?.byteLength ?? 0) +
  records.columns.reduce(
    (total, column) =>
      total +
      (column.doubles?.byteLength ?? 0) +
      (column.indices?.byteLength ?? 0) +
      (column.presence?.byteLength ?? 0),
    0,
  );

export const encodeRecords = (records: EncodedRecords): ArrayBuffer => {
  const builder = new flatbuffers.Builder(estimatedSize(records));

  const columns = Records.createColumnsVector(
    builder,
    records.columns.map((column) => encodeColumn(builder, column)),
  );
  const kinds = Records.createKindsVector(builder, records.kinds);
  const recordPolygons = Records.createRecordPolygonsVector(
    builder,
    records.recordPolygons,
  );
  const polygonRings = Records.createPolygonRingsVector(
    builder,
    records.polygonRings,
  );
  const ringPositions = Records.createRingPositionsVector(
    builder,
    records.ringPositions,
  );
  const xy = Records.createXyVector(builder, records.xy);
  const z = records.z ? Records.createZVector(builder, records.z) : 0;

  Records.finishRecordsBuffer(
    builder,
    Records.createRecords(
      builder,
      records.count,
      kinds,
      recordPolygons,
      polygonRings,
      ringPositions,
      xy,
      z,
      columns,
    ),
  );

  return builder.asUint8Array().slice().buffer;
};

export type DecodedColumn = {
  name: string;
  kind: ColumnKind;
  doubles: Float64Array | null;
  indices: Uint32Array | null;
  presence: Uint8Array | null;
  dictionaryLength: number;
  dictionaryAt: (index: number) => string;
};

export type DecodedRecords = Omit<EncodedRecords, "columns"> & {
  columns: DecodedColumn[];
};

const decodeColumn = (column: Column): DecodedColumn => ({
  name: column.name() ?? "",
  kind: column.kind(),
  doubles: column.doublesArray(),
  indices: column.indicesArray(),
  presence: column.presenceArray(),
  dictionaryLength: column.dictionaryLength(),
  dictionaryAt: (index) => column.dictionary(index),
});

const NO_OFFSETS = new Uint32Array(1);

export const decodeRecords = (bytes: ArrayBuffer): DecodedRecords => {
  const records = Records.getRootAsRecords(
    new flatbuffers.ByteBuffer(new Uint8Array(bytes)),
  );

  const columns: DecodedColumn[] = [];
  for (let i = 0; i < records.columnsLength(); i++) {
    columns.push(decodeColumn(records.columns(i) as Column));
  }

  return {
    count: records.count(),
    kinds: records.kindsArray() ?? new Uint8Array(),
    recordPolygons: records.recordPolygonsArray() ?? NO_OFFSETS,
    polygonRings: records.polygonRingsArray() ?? NO_OFFSETS,
    ringPositions: records.ringPositionsArray() ?? NO_OFFSETS,
    xy: records.xyArray() ?? new Float64Array(),
    z: records.zArray(),
    columns,
  };
};
