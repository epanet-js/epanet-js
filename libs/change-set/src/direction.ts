import type { Cell, ChangeRecord } from "./types";

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
