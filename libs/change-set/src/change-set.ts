import { decode, encode, isStringKeyed, readVersion } from "./codec";
import { CURRENT_VERSION } from "./versioning";
import {
  type Cell,
  type ChangeKind,
  type ChangeRecord,
  type DecodedChangeSet,
  type EntityKind,
} from "./types";

export class ChangeSet {
  readonly bytes: Uint8Array;
  private decoded: DecodedChangeSet | null = null;
  private schemaVersion: number | null = null;

  private constructor(bytes: Uint8Array) {
    this.bytes = bytes;
  }

  static of(name: string, records: readonly ChangeRecord[]): ChangeSet {
    return ChangeSet.atVersion(CURRENT_VERSION, name, records);
  }

  static atVersion(
    version: number,
    name: string,
    records: readonly ChangeRecord[],
  ): ChangeSet {
    return new ChangeSet(encode(name, mergeRecords(records), version));
  }

  static fromBytes(bytes: Uint8Array): ChangeSet {
    return new ChangeSet(bytes);
  }

  static empty(name = ""): ChangeSet {
    return ChangeSet.of(name, []);
  }

  read(): DecodedChangeSet {
    if (!this.decoded) this.decoded = decode(this.bytes);
    return this.decoded;
  }

  get name(): string {
    return this.read().name;
  }

  get version(): number {
    if (this.schemaVersion === null) {
      this.schemaVersion = this.decoded
        ? this.decoded.version
        : readVersion(this.bytes);
    }
    return this.schemaVersion;
  }

  get records(): ChangeRecord[] {
    return this.read().records;
  }

  get byteLength(): number {
    return this.bytes.byteLength;
  }

  get isEmpty(): boolean {
    return this.read().records.length === 0;
  }

  summary(): { entity: EntityKind; kind: ChangeKind; count: number }[] {
    const counts = new Map<
      string,
      { entity: EntityKind; kind: ChangeKind; count: number }
    >();
    for (const record of this.read().records) {
      const key = `${record.entity}|${record.kind}`;
      const existing = counts.get(key);
      if (existing) existing.count += 1;
      else
        counts.set(key, { entity: record.entity, kind: record.kind, count: 1 });
    }
    return [...counts.values()];
  }
}

type Accumulated = {
  entity: EntityKind;
  id: number | string;
  firstKind: ChangeKind;
  lastKind: ChangeKind;
  before: Map<string, Cell>;
  after: Map<string, Cell>;
};

const accumulate = (
  accumulated: Map<string, Accumulated>,
  record: ChangeRecord,
): void => {
  const key = `${record.entity}|${isStringKeyed(record.entity) ? String(record.id) : Number(record.id)}`;
  let entry = accumulated.get(key);

  if (!entry) {
    entry = {
      entity: record.entity,
      id: record.id,
      firstKind: record.kind,
      lastKind: record.kind,
      before: new Map(),
      after: new Map(),
    };
    accumulated.set(key, entry);
  }
  entry.lastKind = record.kind;

  for (const [field, value] of Object.entries(record.before)) {
    if (!entry.before.has(field)) entry.before.set(field, value);
  }
  for (const [field, value] of Object.entries(record.after)) {
    entry.after.set(field, value);
  }
};

const toRecord = (entry: Accumulated): ChangeRecord | null => {
  if (entry.firstKind === "create" && entry.lastKind === "delete") return null;

  const kind: ChangeKind =
    entry.firstKind === "create"
      ? "create"
      : entry.lastKind === "delete"
        ? "delete"
        : "update";

  return {
    entity: entry.entity,
    id: entry.id,
    kind,
    before: kind === "create" ? {} : Object.fromEntries(entry.before),
    after: kind === "delete" ? {} : Object.fromEntries(entry.after),
  };
};

export const mergeRecords = (
  records: readonly ChangeRecord[],
): ChangeRecord[] => {
  const accumulated = new Map<string, Accumulated>();
  for (const record of records) accumulate(accumulated, record);

  const merged: ChangeRecord[] = [];
  for (const entry of accumulated.values()) {
    const record = toRecord(entry);
    if (record) merged.push(record);
  }
  return merged;
};

export const squash = (
  name: string,
  changeSets: readonly ChangeSet[],
): ChangeSet => {
  const all: ChangeRecord[] = [];
  for (const changeSet of changeSets) {
    // Appended one at a time on purpose: `push(...records)` passes every record
    // as an argument, which blows the call stack on a network-sized change set.
    for (const record of changeSet.records) all.push(record);
  }
  return ChangeSet.of(name, all);
};
