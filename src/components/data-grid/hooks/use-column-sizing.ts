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

  const fitWidthToContent = useCallback((columnId: string) => {
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

  return { fillSizesRef, fitWidthToContent };
}

export function useFitColumnWidth<TData>(
  table: Table<TData>,
  containerRef: React.RefObject<HTMLElement>,
) {
  const tableRef = useRef(table);
  tableRef.current = table;
  const fittedSizesRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const sizing = table.getState().columnSizing;
    for (const columnId of Object.keys(fittedSizesRef.current)) {
      if (sizing[columnId] !== fittedSizesRef.current[columnId]) {
        delete fittedSizesRef.current[columnId];
      }
    }
  }, [table.getState().columnSizing]); // eslint-disable-line react-hooks/exhaustive-deps

  const fitWidthToContent = useCallback(
    (columnId: string) => {
      const t = tableRef.current;
      const col = t.getColumn(columnId);
      if (!col) return;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        col.resetSize();
        return;
      }

      const { cellFont, headerFont } = resolveCanvasFonts(containerRef.current);
      const colDef = col.columnDef;

      const minWidth = measureHeaderMinWidth(ctx, headerFont);

      let contentWidth = 0;
      const isDataFitted = columnId in fittedSizesRef.current;
      if (isDataFitted) {
        ctx.font = headerFont;
        const headerText =
          typeof colDef.header === "string" ? colDef.header : "";
        contentWidth = ctx.measureText(headerText).width;
        delete fittedSizesRef.current[columnId];
      }

      const cellWidth = measureMaxCellWidth(
        ctx,
        cellFont,
        t.getRowModel().rows,
        colDef as ColDefForSizing,
      );
      contentWidth = Math.max(contentWidth, cellWidth);

      const extraWidth = (colDef as ColDefForSizing).autoSizeExtraWidth ?? 16;
      const newSize = Math.max(
        Math.ceil(contentWidth) + extraWidth + 2,
        minWidth,
      );

      if (!isDataFitted) fittedSizesRef.current[columnId] = newSize;
      t.setColumnSizing((prev) => ({ ...prev, [columnId]: newSize }));
    },
    [containerRef],
  );

  return { fitWidthToContent };
}

// actions button w-6 -mr-1 (20) + border (2)
const HEADER_SORT_BUTTON_AND_BORDER = 22;

function resolveCanvasFonts(el: HTMLElement | null): {
  cellFont: string;
  headerFont: string;
} {
  const computedStyle = el ? getComputedStyle(el) : null;
  const fontSize = computedStyle?.fontSize ?? "14px";
  const fontFamily =
    computedStyle?.fontFamily ?? "ui-sans-serif, system-ui, sans-serif";
  return {
    cellFont: `${fontSize} ${fontFamily}`,
    headerFont: `600 ${fontSize} ${fontFamily}`,
  };
}

function measureHeaderMinWidth(
  ctx: CanvasRenderingContext2D,
  headerFont: string,
): number {
  ctx.font = headerFont;
  const ellipsisWidth = ctx.measureText("…").width;
  const wideCharWidth = ctx.measureText("W").width;
  return (
    Math.ceil(wideCharWidth + ellipsisWidth) + HEADER_SORT_BUTTON_AND_BORDER
  );
}

type ColDefForSizing = {
  accessorKey?: string;
  copyValue?: (v: unknown) => string;
  autoSizeExtraWidth?: number;
};

function measureMaxCellWidth(
  ctx: CanvasRenderingContext2D,
  cellFont: string,
  rows: { getValue: (id: string) => unknown }[],
  colDef: ColDefForSizing,
): number {
  ctx.font = cellFont;
  const columnId = colDef.accessorKey ?? "";
  const { copyValue } = colDef;
  let maxWidth = 0;
  for (const row of rows) {
    const value = row.getValue(columnId);
    const text = copyValue ? copyValue(value) : String(value ?? "");
    const w = ctx.measureText(text).width;
    if (w > maxWidth) maxWidth = w;
  }
  return maxWidth;
}
