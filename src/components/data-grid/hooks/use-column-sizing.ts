import { useCallback, useEffect, useRef } from "react";
import { Table } from "@tanstack/react-table";

export const FIXED_COLUMN_SIZE = 32;

export function getReservedWidth({
  gutterColumn,
  rowActions,
  readOnly,
  scrollbarWidth = 0,
}: {
  gutterColumn: boolean;
  rowActions: unknown;
  readOnly: boolean;
  scrollbarWidth?: number;
}): number {
  const gutterW = gutterColumn ? FIXED_COLUMN_SIZE : 0;
  const actionsW = !readOnly && rowActions ? FIXED_COLUMN_SIZE : 0;
  return gutterW + actionsW + scrollbarWidth;
}

type UseColumnSizingOptions<TData> = {
  table: Table<TData>;
  containerRef: React.RefObject<HTMLDivElement>;
  reservedWidth: number;
};

export function useColumnSizing<TData>({
  table,
  containerRef,
  reservedWidth,
}: UseColumnSizingOptions<TData>) {
  const tableRef = useRef(table);
  tableRef.current = table;

  const fillSizesRef = useRef<Record<string, number>>({});

  useEffect(
    function fillAvailableWidth() {
      if (!tableRef.current.options.enableColumnResizing) return;
      const container = containerRef.current;
      if (!container) return;

      const observer = new ResizeObserver((entries) => {
        const available = (entries[0]?.contentRect.width ?? 0) - reservedWidth;
        if (available <= 0) return;

        const t = tableRef.current;
        const leafCols = t.getAllLeafColumns();
        const currentSizing = t.getState().columnSizing;

        const resizableCols = leafCols.filter((col) => col.getCanResize());
        const fixedCols = leafCols.filter((col) => !col.getCanResize());
        const fixedTotal = fixedCols.reduce(
          (sum, col) => sum + (currentSizing[col.id] ?? col.getSize()),
          0,
        );
        const availableForResizable = available - fixedTotal;

        const resizableSizes = resizableCols.map(
          (col) => currentSizing[col.id] ?? col.getSize(),
        );
        const resizableTotal = resizableSizes.reduce((a, b) => a + b, 0);
        if (resizableTotal <= 0) return;
        const scale = availableForResizable / resizableTotal;
        const newSizing = Object.fromEntries([
          ...fixedCols.map((col) => [
            col.id,
            currentSizing[col.id] ?? col.getSize(),
          ]),
          ...resizableCols.map((col, i) => [
            col.id,
            Math.floor(
              Math.min(
                Math.max(
                  resizableSizes[i] * scale,
                  col.columnDef.minSize ?? t.options.defaultColumn!.minSize!,
                ),
                col.columnDef.maxSize ?? available,
              ),
            ),
          ]),
        ]);
        fillSizesRef.current = newSizing;
        t.setColumnSizing(newSizing);
        t.setColumnSizingInfo((prev) => ({
          ...prev,
          columnSizingStart: Object.entries(newSizing),
        }));
      });

      observer.observe(container);
      return () => observer.disconnect();
    },
    [containerRef, reservedWidth],
  );

  const resetColumnSize = useCallback((columnId: string) => {
    const fillSize = fillSizesRef.current[columnId];
    if (fillSize !== undefined) {
      tableRef.current.setColumnSizing((prev) => ({
        ...prev,
        [columnId]: fillSize,
      }));
    } else {
      tableRef.current.getColumn(columnId)?.resetSize();
    }
  }, []);

  return { fillSizesRef, resetColumnSize };
}
