import type { ChangeSet } from "./change-set";
import type { ChangeEntry, Side } from "./codec";
import type { Cell, ChangeKind, ChangeRecord, EntityKind } from "./types";

export type Direction = "forward" | "reverse";

export type Effective = {
  kind: "create" | "update" | "delete";
  fields: Record<string, Cell>;
};

export const effective = (
  record: ChangeRecord,
  direction: Direction,
): Effective => {
  if (direction === "forward") {
    if (record.kind === "create") {
      return { kind: "create", fields: record.after };
    }
    if (record.kind === "delete") {
      return { kind: "delete", fields: record.before };
    }
    return { kind: "update", fields: record.after };
  }
  if (record.kind === "create") return { kind: "delete", fields: record.after };
  if (record.kind === "delete") {
    return { kind: "create", fields: record.before };
  }
  return { kind: "update", fields: record.before };
};

export const effectiveSide = (
  kind: ChangeKind,
  direction: Direction,
): { kind: ChangeKind; side: Side } => {
  if (direction === "forward") {
    return { kind, side: kind === "delete" ? "before" : "after" };
  }
  if (kind === "create") return { kind: "delete", side: "after" };
  if (kind === "delete") return { kind: "create", side: "before" };
  return { kind: "update", side: "before" };
};

export type EntityChange = {
  entity: EntityKind;
  id: number | string;
  change: Effective;
};

const entityChange = (
  entry: ChangeEntry,
  direction: Direction,
): EntityChange => {
  const { kind, side } = effectiveSide(entry.kind, direction);
  let fields: Record<string, Cell> | null = null;
  return {
    entity: entry.entity,
    id: entry.id,
    change: {
      kind,
      get fields() {
        fields ??= entry.fields(side);
        return fields;
      },
    },
  };
};

export function* effectiveChanges(
  changeSet: ChangeSet,
  direction: Direction,
): Generator<EntityChange> {
  for (const entry of changeSet.entries()) {
    yield entityChange(entry, direction);
  }
}
