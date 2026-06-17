import type {
  Column,
  Row,
  RowData,
  Table,
  TableFeature,
} from "@tanstack/react-table";
import { type LazyRowModel } from "../models/lazy-core-row-model";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    autoSizeExtraWidth?: number;
    placeholder?: string;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Column<TData extends RowData, TValue> {
    getAutoSizeExtraWidth: () => number;
    getPlaceholder: () => string | undefined;
    fitWidthToContent: (container?: HTMLElement | null) => void;
  }
}

const DEFAULT_AUTO_SIZE_EXTRA_WIDTH = 16;
// actions button w-6 -mr-1 (20) + border (2)
const HEADER_SORT_BUTTON_AND_BORDER = 22;

function rowsToMeasure<TData extends RowData>(
  table: Table<TData>,
): Row<TData>[] {
  const model = table.getRowModel() as LazyRowModel<TData>;
  return model.getMaterializedRows();
}

function resolveCanvasFonts(el: HTMLElement | null | undefined): {
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

function measureMaxCellWidth<TData>(
  ctx: CanvasRenderingContext2D,
  cellFont: string,
  rows: { getValue: (id: string) => unknown }[],
  column: Column<TData, unknown>,
): number {
  ctx.font = cellFont;
  let maxWidth = 0;
  for (const row of rows) {
    const value = row.getValue(column.id);
    if (typeof value === "boolean") continue;
    const text = column.getCopyValue(value);
    const w = ctx.measureText(text).width;
    if (w > maxWidth) maxWidth = w;
  }
  return maxWidth;
}

export const ColumnSizingFeature: TableFeature = {
  createColumn: <TData extends RowData>(
    column: Column<TData, unknown>,
    table: Table<TData>,
  ): void => {
    column.getAutoSizeExtraWidth = () =>
      column.columnDef.meta?.autoSizeExtraWidth ??
      DEFAULT_AUTO_SIZE_EXTRA_WIDTH;

    column.getPlaceholder = () => column.columnDef.meta?.placeholder;

    column.fitWidthToContent = (container?: HTMLElement | null) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        column.resetSize();
        return;
      }

      const { cellFont, headerFont } = resolveCanvasFonts(container);
      const minWidth = measureHeaderMinWidth(ctx, headerFont);

      ctx.font = headerFont;
      const header = column.columnDef.header;
      const headerText = typeof header === "string" ? header : "";
      const headerWidth = ctx.measureText(headerText).width;

      const cellWidth = measureMaxCellWidth(
        ctx,
        cellFont,
        rowsToMeasure(table),
        column,
      );

      ctx.font = cellFont;
      const placeholder = column.getPlaceholder();
      const placeholderWidth = placeholder
        ? ctx.measureText(placeholder).width
        : 0;

      const contentWidth = Math.max(headerWidth, cellWidth, placeholderWidth);
      const extraWidth = column.getAutoSizeExtraWidth();
      const newSize = Math.max(
        Math.ceil(contentWidth) + extraWidth + 2,
        minWidth,
      );

      table.setColumnSizing((prev) => ({ ...prev, [column.id]: newSize }));
    };
  },
};
