import type { RowData } from "@tanstack/react-table";

/**
 * The first argument accepted by the column helpers. Either:
 * - a plain `accessorKey` string (the value is read directly off the row,
 *   e.g. a model object's getter), or
 * - an explicit `{ id, accessorFn }` for computed/derived values that aren't
 *   a direct property of the row.
 *
 * In both cases the resulting `column.id` is the flat field name, which the
 * edit / clipboard / sorting / warning code keys on.
 */
export type ColumnKey<TData extends RowData, TValue> =
  | (Extract<keyof TData, string> & string)
  | { id: string; accessorFn: (row: TData) => TValue };

export function resolveColumnKey<TData extends RowData, TValue>(
  key: ColumnKey<TData, TValue>,
):
  | { accessorKey: Extract<keyof TData, string> & string }
  | { id: string; accessorFn: (row: TData) => TValue } {
  return typeof key === "string"
    ? { accessorKey: key }
    : { id: key.id, accessorFn: key.accessorFn };
}

export function columnKeyId<TData extends RowData, TValue>(
  key: ColumnKey<TData, TValue>,
): string {
  return typeof key === "string" ? key : key.id;
}
