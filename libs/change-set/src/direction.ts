import type { Side } from "./codec";
import type { Cell, ChangeKind, ChangeRecord } from "./types";

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
