import type { RowData, Table } from "@tanstack/react-table";

/**
 * Map a visual (display) row position to its index in the original `data` array.
 *
 * Sorting reorders the display, but column read-only rules and accessors address
 * rows by data index (e.g. `getRow(dataIndex)`). Interaction handlers only know
 * the visual position (from the selection / virtualizer), so they must translate
 * before calling `column.isReadOnly(...)` — otherwise a sorted grid checks the
 * wrong row. Unsorted order is identity. Avoids materializing a `Row`.
 */
export const resolveDataIndex = <TData extends RowData>(
  table: Table<TData>,
  visualRow: number,
): number => {
  const { orderByDataIndex } = table.getLazyRowOrder();
  return orderByDataIndex ? orderByDataIndex[visualRow] : visualRow;
};
