import { RefObject, useEffect, useRef } from "react";
import { Table } from "@tanstack/react-table";
import { FIXED_COLUMN_SIZE } from "../shared/dimensions";

type Options<TData extends Record<string, unknown>> = {
  scrollRef: RefObject<HTMLDivElement | null>;
  table: Table<TData>;
  gutterColumn: boolean;
  rowHeight: number;
};

export function useScrollActiveCellIntoView<
  TData extends Record<string, unknown>,
>({ scrollRef, table, gutterColumn, rowHeight }: Options<TData>) {
  const activeCell = table.getActiveCell();
  // Avoid triggering if last active cell is the same as new one.
  const activeCellKey = activeCell
    ? `${activeCell.row}:${activeCell.col}`
    : null;
  const lastScrolledKey = useRef<string | null>(null);

  useEffect(
    function keepActiveCellInViewPort() {
      if (activeCellKey === lastScrolledKey.current) return;
      lastScrolledKey.current = activeCellKey;

      const container = scrollRef.current;
      if (!activeCell || !container) return;

      const rowTop = (activeCell.row + 1) * rowHeight;
      const rowBottom = (activeCell.row + 2) * rowHeight;

      const visibleTop = container.scrollTop + rowHeight;
      const visibleBottom = container.scrollTop + container.clientHeight;

      if (rowTop < visibleTop) {
        container.scrollTop = rowTop - rowHeight;
      } else if (rowBottom > visibleBottom) {
        container.scrollTop = rowBottom - container.clientHeight;
      }

      const gutterWidth = gutterColumn ? FIXED_COLUMN_SIZE : 0;
      const leafColumns = table.getAllLeafColumns();
      let colStart = gutterWidth;
      for (let i = 0; i < activeCell.col; i++) {
        colStart += leafColumns[i]?.getSize() ?? 100;
      }
      const colEnd = colStart + (leafColumns[activeCell.col]?.getSize() ?? 100);

      const scrollLeft = container.scrollLeft;
      const viewportWidth = container.clientWidth;

      if (colStart < scrollLeft + gutterWidth) {
        container.scrollLeft = colStart - gutterWidth;
      } else if (colEnd > scrollLeft + viewportWidth) {
        container.scrollLeft = colEnd - viewportWidth;
      }
    },
    [activeCellKey, activeCell, gutterColumn, table, scrollRef, rowHeight],
  );
}
