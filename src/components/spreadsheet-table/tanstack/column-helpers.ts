import { SpreadsheetColumnDef } from "./types";

/**
 * Compatibility helper that mimics react-datasheet-grid's keyColumn function.
 * Combines an accessor key with a partial column definition.
 *
 * Usage:
 * ```typescript
 * const columns = [
 *   {
 *     ...keyColumn("fieldName", createFloatColumn({ deleteValue: 0 })),
 *     title: "Field Name",
 *   },
 * ];
 * ```
 */
export function keyColumn<TData extends Record<string, unknown>, TValue>(
  key: keyof TData & string,
  column: Partial<SpreadsheetColumnDef<TData, TValue>>,
): Partial<SpreadsheetColumnDef<TData, TValue>> {
  return {
    ...column,
    accessorKey: key,
    id: key,
  };
}

/**
 * Type alias for column definition that matches react-datasheet-grid's Column type.
 * Used for consumers that type their column arrays.
 */
export type Column<
  TData extends Record<string, unknown> = Record<string, unknown>,
  TValue = unknown,
> = SpreadsheetColumnDef<TData, TValue>;
