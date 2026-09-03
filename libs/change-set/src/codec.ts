import * as flatbuffers from "flatbuffers";

import { Bools } from "./generated/change-set-fb/bools";
import { ChangeSet as FbChangeSet } from "./generated/change-set-fb/change-set";
import { Column } from "./generated/change-set-fb/column";
import { Doubles } from "./generated/change-set-fb/doubles";
import { Entity } from "./generated/change-set-fb/entity";
import { Json } from "./generated/change-set-fb/json";
import { Kind } from "./generated/change-set-fb/kind";
import { Op } from "./generated/change-set-fb/op";
import { Presence } from "./generated/change-set-fb/presence";
import { Texts } from "./generated/change-set-fb/texts";
import { Values } from "./generated/change-set-fb/values";

import {
  type Cell,
  type ChangeKind,
  type ChangeRecord,
  type DecodedChangeSet,
  type EntityKind,
  entityKinds,
} from "./types";

const entityToFb: Record<EntityKind, Entity> = {
  junction: Entity.Junction,
  reservoir: Entity.Reservoir,
  tank: Entity.Tank,
  pipe: Entity.Pipe,
  pump: Entity.Pump,
  valve: Entity.Valve,
  customerPoint: Entity.CustomerPoint,
  curve: Entity.Curve,
  pattern: Entity.Pattern,
  control: Entity.Control,
  junctionDemand: Entity.JunctionDemand,
  customerDemand: Entity.CustomerDemand,
  customAttribute: Entity.CustomAttribute,
  pipeLibrary: Entity.PipeLibrary,
  rawControls: Entity.RawControls,
};

const fbToEntity = new Map<Entity, EntityKind>(
  entityKinds.map((kind) => [entityToFb[kind], kind]),
);

const kindToFb: Record<ChangeKind, Kind> = {
  create: Kind.Create,
  update: Kind.Update,
  delete: Kind.Delete,
};

const fbToKind = new Map<Kind, ChangeKind>([
  [Kind.Create, "create"],
  [Kind.Update, "update"],
  [Kind.Delete, "delete"],
]);

const stringKeyed = new Set<EntityKind>(["control", "customAttribute"]);

export const isStringKeyed = (entity: EntityKind): boolean =>
  stringKeyed.has(entity);

type ColumnDraft = { field: string; before: Cell[]; after: Cell[] };

type OpDraft = {
  entity: EntityKind;
  kind: ChangeKind;
  ids: number[];
  keys: string[];
  columns: ColumnDraft[];
};

const fieldsOf = (record: ChangeRecord): string[] => {
  const fields = new Set([
    ...Object.keys(record.before),
    ...Object.keys(record.after),
  ]);
  return [...fields].sort();
};

const groupRecords = (records: readonly ChangeRecord[]): OpDraft[] => {
  const groups = new Map<string, OpDraft>();

  for (const record of records) {
    const fields = fieldsOf(record);
    const groupKey = `${record.entity}|${record.kind}|${fields.join(",")}`;

    let group = groups.get(groupKey);
    if (!group) {
      group = {
        entity: record.entity,
        kind: record.kind,
        ids: [],
        keys: [],
        columns: fields.map((field) => ({ field, before: [], after: [] })),
      };
      groups.set(groupKey, group);
    }

    if (isStringKeyed(record.entity)) {
      group.keys.push(String(record.id));
    } else {
      group.ids.push(Number(record.id));
    }

    for (const column of group.columns) {
      if (record.kind !== "create")
        column.before.push(record.before[column.field]);
      if (record.kind !== "delete")
        column.after.push(record.after[column.field]);
    }
  }

  return [...groups.values()];
};

type Encoded =
  | { tag: "doubles"; values: number[]; nulls: number[] }
  | { tag: "bools"; values: number[]; nulls: number[] }
  | { tag: "texts"; values: string[]; nulls: number[] }
  | { tag: "json"; values: string[]; nulls: number[] };

const presenceOf = (cell: Cell): Presence => {
  if (cell === undefined) return Presence.Absent;
  if (cell === null) return Presence.Null;
  return Presence.Present;
};

const pickTag = (cells: readonly Cell[]): Encoded["tag"] => {
  let tag: Encoded["tag"] | null = null;
  for (const cell of cells) {
    if (cell === null || cell === undefined) continue;
    const candidate: Encoded["tag"] =
      typeof cell === "number"
        ? "doubles"
        : typeof cell === "boolean"
          ? "bools"
          : typeof cell === "string"
            ? "texts"
            : "json";
    if (tag === null) tag = candidate;
    // Mixed primitive types cannot share a typed vector; JSON holds all of them.
    else if (tag !== candidate) return "json";
  }
  return tag ?? "doubles";
};

const encodeCells = (cells: readonly Cell[]): Encoded => {
  const tag = pickTag(cells);
  const nulls = cells.map((cell) => presenceOf(cell) as number);

  if (tag === "doubles") {
    return {
      tag,
      values: cells.map((cell) => (typeof cell === "number" ? cell : 0)),
      nulls,
    };
  }
  if (tag === "bools") {
    return { tag, values: cells.map((cell) => (cell === true ? 1 : 0)), nulls };
  }
  if (tag === "texts") {
    return {
      tag,
      values: cells.map((cell) => (typeof cell === "string" ? cell : "")),
      nulls,
    };
  }
  return {
    tag,
    values: cells.map((cell) =>
      cell === null || cell === undefined ? "" : JSON.stringify(cell),
    ),
    nulls,
  };
};

const collapse = (encoded: Encoded, count: number): Encoded => {
  if (count < 2) return encoded;
  const first = encoded.values[0];
  const firstNull = encoded.nulls[0];
  for (let i = 1; i < count; i++) {
    if (encoded.values[i] !== first || encoded.nulls[i] !== firstNull) {
      return encoded;
    }
  }
  const nulls = [firstNull];
  if (encoded.tag === "doubles" || encoded.tag === "bools") {
    return { tag: encoded.tag, values: [first as number], nulls };
  }
  return { tag: encoded.tag, values: [first as string], nulls };
};

const writeValues = (
  builder: flatbuffers.Builder,
  encoded: Encoded,
): { type: Values; offset: flatbuffers.Offset } => {
  if (encoded.tag === "doubles") {
    const v = Doubles.createVVector(builder, encoded.values);
    const n = Doubles.createNullsVector(builder, encoded.nulls);
    Doubles.startDoubles(builder);
    Doubles.addV(builder, v);
    Doubles.addNulls(builder, n);
    return { type: Values.Doubles, offset: Doubles.endDoubles(builder) };
  }
  if (encoded.tag === "bools") {
    const v = Bools.createVVector(builder, encoded.values);
    const n = Bools.createNullsVector(builder, encoded.nulls);
    Bools.startBools(builder);
    Bools.addV(builder, v);
    Bools.addNulls(builder, n);
    return { type: Values.Bools, offset: Bools.endBools(builder) };
  }
  const strings = encoded.values.map((value) => builder.createString(value));
  if (encoded.tag === "texts") {
    const v = Texts.createVVector(builder, strings);
    const n = Texts.createNullsVector(builder, encoded.nulls);
    Texts.startTexts(builder);
    Texts.addV(builder, v);
    Texts.addNulls(builder, n);
    return { type: Values.Texts, offset: Texts.endTexts(builder) };
  }
  const v = Json.createVVector(builder, strings);
  const n = Json.createNullsVector(builder, encoded.nulls);
  Json.startJson(builder);
  Json.addV(builder, v);
  Json.addNulls(builder, n);
  return { type: Values.Json, offset: Json.endJson(builder) };
};

export const encode = (
  name: string,
  records: readonly ChangeRecord[],
  version: number,
): Uint8Array => {
  const builder = new flatbuffers.Builder(1024);
  const ops = groupRecords(records);

  const opOffsets = ops.map((op) => {
    const count = op.ids.length + op.keys.length;

    const columnOffsets = op.columns.map((column) => {
      const fieldOffset = builder.createString(column.field);
      const before =
        op.kind === "create"
          ? null
          : writeValues(builder, collapse(encodeCells(column.before), count));
      const after =
        op.kind === "delete"
          ? null
          : writeValues(builder, collapse(encodeCells(column.after), count));

      Column.startColumn(builder);
      Column.addField(builder, fieldOffset);
      if (before) {
        Column.addBeforeType(builder, before.type);
        Column.addBefore(builder, before.offset);
      }
      if (after) {
        Column.addAfterType(builder, after.type);
        Column.addAfter(builder, after.offset);
      }
      return Column.endColumn(builder);
    });

    const colsOffset = Op.createColsVector(builder, columnOffsets);
    const idsOffset = Op.createIdsVector(builder, op.ids);
    const keysOffset = Op.createKeysVector(
      builder,
      op.keys.map((key) => builder.createString(key)),
    );

    Op.startOp(builder);
    Op.addEntity(builder, entityToFb[op.entity]);
    Op.addKind(builder, kindToFb[op.kind]);
    Op.addIds(builder, idsOffset);
    Op.addKeys(builder, keysOffset);
    Op.addCols(builder, colsOffset);
    return Op.endOp(builder);
  });

  const nameOffset = builder.createString(name);
  const opsOffset = FbChangeSet.createOpsVector(builder, opOffsets);
  FbChangeSet.startChangeSet(builder);
  FbChangeSet.addName(builder, nameOffset);
  FbChangeSet.addOps(builder, opsOffset);
  FbChangeSet.addVersion(builder, version);
  builder.finish(FbChangeSet.endChangeSet(builder));

  return builder.asUint8Array().slice();
};

const readCell = (
  type: Values,
  column: Column,
  side: "before" | "after",
  index: number,
): Cell => {
  // The generated union accessors are typed `any`; this is the one place that
  // gets pinned back down to the table it was asked for.
  const read = <T extends Doubles | Bools | Texts | Json>(obj: T): T | null =>
    (side === "before" ? column.before(obj) : column.after(obj)) as T | null;

  const at = (length: number) => (length === 1 ? 0 : index);

  switch (type) {
    case Values.Doubles: {
      const values = read(new Doubles());
      if (!values) return undefined;
      const i = at(values.vLength());
      const presence = values.nulls(values.nullsLength() === 1 ? 0 : index);
      if (presence === Presence.Absent) return undefined;
      if (presence === Presence.Null) return null;
      return values.v(i);
    }
    case Values.Bools: {
      const values = read(new Bools());
      if (!values) return undefined;
      const i = at(values.vLength());
      const presence = values.nulls(values.nullsLength() === 1 ? 0 : index);
      if (presence === Presence.Absent) return undefined;
      if (presence === Presence.Null) return null;
      return values.v(i) === 1;
    }
    case Values.Texts: {
      const values = read(new Texts());
      if (!values) return undefined;
      const i = at(values.vLength());
      const presence = values.nulls(values.nullsLength() === 1 ? 0 : index);
      if (presence === Presence.Absent) return undefined;
      if (presence === Presence.Null) return null;
      return values.v(i);
    }
    case Values.Json: {
      const values = read(new Json());
      if (!values) return undefined;
      const i = at(values.vLength());
      const presence = values.nulls(values.nullsLength() === 1 ? 0 : index);
      if (presence === Presence.Absent) return undefined;
      if (presence === Presence.Null) return null;
      const parsed: unknown = JSON.parse(values.v(i) ?? "null");
      return parsed as Cell;
    }
    default:
      return undefined;
  }
};

// One scalar off the root table, so a load can ask every stored change set its
// version without paying for a decode it may not need.
export const readVersion = (bytes: Uint8Array): number =>
  FbChangeSet.getRootAsChangeSet(new flatbuffers.ByteBuffer(bytes)).version();

export const decode = (bytes: Uint8Array): DecodedChangeSet => {
  const root = FbChangeSet.getRootAsChangeSet(
    new flatbuffers.ByteBuffer(bytes),
  );
  const records: ChangeRecord[] = [];

  for (let o = 0; o < root.opsLength(); o++) {
    const op = root.ops(o);
    if (!op) continue;

    const entity = fbToEntity.get(op.entity());
    const kind = fbToKind.get(op.kind());
    if (!entity || !kind) continue;

    const useKeys = op.keysLength() > 0;
    const count = useKeys ? op.keysLength() : op.idsLength();

    for (let i = 0; i < count; i++) {
      const id = useKeys ? (op.keys(i) ?? "") : (op.ids(i) ?? 0);
      const before: Record<string, Cell> = {};
      const after: Record<string, Cell> = {};

      for (let c = 0; c < op.colsLength(); c++) {
        const column = op.cols(c);
        if (!column) continue;
        const field = column.field();
        if (field === null) continue;

        if (kind !== "create") {
          before[field] = readCell(column.beforeType(), column, "before", i);
        }
        if (kind !== "delete") {
          after[field] = readCell(column.afterType(), column, "after", i);
        }
      }

      records.push({ entity, id, kind, before, after });
    }
  }

  return { name: root.name() ?? "", version: root.version(), records };
};
