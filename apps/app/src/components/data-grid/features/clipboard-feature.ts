import type {
  Column,
  Row,
  RowData,
  Table,
  TableFeature,
} from "@tanstack/react-table";
import { defaultPatchRow, type PatchRowFn } from "../utils/patch-row";
import { isLazyRowModel } from "../models/lazy-core-row-model";
import type { GridSelection } from "../types";
import { createTimeSlicer } from "src/infra/yield-to-main";

export type CopySelectionOptions = {
  includeHeaders?: boolean;
};

export type ClipboardCopyInfo = {
  requestedRows: number;
  rows: number;
  cols: number;
  allRows: boolean;
  allCols: boolean;
  columnIds: string[];
  includeHeaders: boolean;
};

export type ClipboardPasteInfo = {
  requestedRows: number;
  rows: number;
  cols: number;
  allRows: boolean;
  allCols: boolean;
  columnIds: string[];
};

declare module "@tanstack/react-table" {
  interface TableOptionsResolved<TData extends RowData> {
    includeHeadersOnCopy?: boolean;
    autoExtendOnPaste?: boolean; // pasting extra content appends fresh rows
    maxClipboardRows?: number; // optional cap on rows a single copy/paste handles
    createRow?: () => TData;
    onClipboardCopy?: (info: ClipboardCopyInfo) => void;
    onClipboardPaste?: (info: ClipboardPasteInfo) => void;
    onDataChange?: (data: TData[]) => void | Promise<void>;
    patchRow?: PatchRowFn;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    copyValue?: (value: TValue) => string;
    // Returns undefined to signal "skip this cell"
    pasteValue?: (text: string, row: TData) => TValue | undefined;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Table<TData extends RowData> {
    copySelection: (options?: CopySelectionOptions) => Promise<void>;
    pasteSelection: () => Promise<void>;
    handleCopyEvent: (e: React.ClipboardEvent) => void;
    handlePasteEvent: (e: React.ClipboardEvent) => void;
    applyPaste: (text: string) => Promise<void>;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Column<TData extends RowData, TValue> {
    getCopyValue: (value: unknown) => string;
    getPasteValue: (text: string, row: TData) => unknown;
  }
}

const headerText = <TData extends RowData>(
  column: Column<TData, unknown> | undefined,
): string => {
  const header = column?.columnDef.header;
  return typeof header === "string" ? header : "";
};

const collectColumnIds = <TData extends RowData>(
  columns: Column<TData, unknown>[],
  fromCol: number,
  toColExclusive: number,
): string[] => {
  const ids: string[] = [];
  for (let c = fromCol; c < toColExclusive; c++) {
    const id = columns[c]?.id;
    if (id) ids.push(id);
  }
  return ids;
};

const buildHeaderLine = <TData extends RowData>(
  columns: Column<TData, unknown>[],
  fromCol: number,
  toColInclusive: number,
): string => {
  const headers: string[] = [];
  for (let c = fromCol; c <= toColInclusive; c++) {
    headers.push(headerText(columns[c]));
  }
  return headers.join("\t");
};

const selectionsEqual = (a: GridSelection, b: GridSelection): boolean =>
  a.min.col === b.min.col &&
  a.min.row === b.min.row &&
  a.max.col === b.max.col &&
  a.max.row === b.max.row;

const capRows = (requested: number, max: number | undefined): number =>
  max != null ? Math.min(requested, max) : requested;

type PasteBounds = {
  targetRows: number;
  targetCols: number;
  writtenCols: number;
  requestedRows: number;
};

const resolvePasteBounds = (
  selection: GridSelection,
  clipboard: { rows: number; cols: number },
  columnCount: number,
  visualRowCount: number,
  options: { autoExtendOnPaste?: boolean; maxClipboardRows?: number },
): PasteBounds => {
  const selRows = selection.max.row - selection.min.row + 1;
  const selCols = selection.max.col - selection.min.col + 1;

  const targetCols = Math.max(selCols, clipboard.cols);
  const writtenCols = Math.min(targetCols, columnCount - selection.min.col);

  const tiledRows = Math.max(selRows, clipboard.rows);
  const remainingVisualRows = visualRowCount - selection.min.row;
  const requestedRows = options.autoExtendOnPaste
    ? tiledRows
    : Math.min(tiledRows, Math.max(0, remainingVisualRows));

  const targetRows = capRows(requestedRows, options.maxClipboardRows);

  return { targetRows, targetCols, writtenCols, requestedRows };
};

const createDataIndexResolver = <TData extends RowData>(
  table: Table<TData>,
  sortedRows: Row<TData>[],
): ((visualRow: number) => number) => {
  const orderByDataIndex = isLazyRowModel(table)
    ? table.getLazyRowOrder().orderByDataIndex
    : null;
  return (visualRow) => {
    if (orderByDataIndex) return orderByDataIndex[visualRow];
    if (isLazyRowModel(table)) return visualRow;
    return sortedRows[visualRow].index;
  };
};

const collectRowPatches = <TData extends RowData>(
  clipboardRow: string[],
  columns: Column<TData, unknown>[],
  startCol: number,
  targetCols: number,
  dataIdx: number,
  existing: TData,
): Record<string, unknown> => {
  const patches: Record<string, unknown> = {};
  for (let j = 0; j < targetCols; j++) {
    const colIndex = startCol + j;
    if (colIndex >= columns.length) break;

    const column = columns[colIndex];
    if (!column || column.isReadOnly(dataIdx)) continue;

    const cellText = clipboardRow[j % clipboardRow.length] ?? "";
    const pasted = column.getPasteValue(cellText, existing);
    if (pasted === undefined) continue;
    patches[column.id] = pasted;
  }
  return patches;
};

export const ClipboardFeature: TableFeature = {
  createTable: <TData extends RowData>(table: Table<TData>): void => {
    const getData = (): TData[] => table.options.data;

    let lastHeaderlessCopy: {
      selection: GridSelection;
      headerLine: string;
      bodyLength: number;
    } | null = null;

    const writeSelectionToClipboard = async (includeHeaders: boolean) => {
      const selection = table.getSelection?.();
      if (!selection) return;

      const isSameCopyWithHeaderes =
        includeHeaders &&
        lastHeaderlessCopy &&
        selectionsEqual(lastHeaderlessCopy.selection, selection);

      if (isSameCopyWithHeaderes) {
        try {
          const body = await navigator.clipboard.readText();
          if (body.length === lastHeaderlessCopy!.bodyLength) {
            await navigator.clipboard.writeText(
              `${lastHeaderlessCopy!.headerLine}\n${body}`,
            );
            return;
          }
        } catch {
          // Clipboard read denied/unavailable — rebuild below.
        }
      }

      const columns = table.getVisibleLeafColumns();
      const data = getData();
      const dataIndexAt = createDataIndexResolver(
        table,
        table.getRowModel().rows,
      );

      const selRows = selection.max.row - selection.min.row + 1;
      const rowCount = capRows(selRows, table.options.maxClipboardRows);
      const lastRow = selection.min.row + rowCount - 1;
      const dataLines: string[] = [];
      const yieldIfSliceElapsed = createTimeSlicer();
      for (
        let visualRow = selection.min.row;
        visualRow <= lastRow;
        visualRow++
      ) {
        await yieldIfSliceElapsed();
        const dataIdx = dataIndexAt(visualRow);
        const original = data[dataIdx];
        const cells: string[] = [];
        for (let c = selection.min.col; c <= selection.max.col; c++) {
          const column = columns[c];
          if (!column || !original) {
            cells.push("");
            continue;
          }
          const value = column.accessorFn
            ? column.accessorFn(original, dataIdx)
            : undefined;
          cells.push(column.getCopyValue(value));
        }
        dataLines.push(cells.join("\t"));
      }

      const dataText = dataLines.join("\n");
      const headerLine = buildHeaderLine(
        columns,
        selection.min.col,
        selection.max.col,
      );
      lastHeaderlessCopy = includeHeaders
        ? null
        : { selection, headerLine, bodyLength: dataText.length };

      await navigator.clipboard.writeText(
        includeHeaders ? `${headerLine}\n${dataText}` : dataText,
      );
    };

    const resolveIncludeHeaders = (explicit: boolean | undefined): boolean => {
      if (explicit !== undefined) return explicit;
      return table.options.includeHeadersOnCopy ?? false;
    };

    const buildCopyInfo = (
      includeHeaders: boolean,
    ): ClipboardCopyInfo | null => {
      const selection = table.getSelection?.();
      if (!selection) return null;
      const columns = table.getVisibleLeafColumns();
      const data = getData();
      const selRows = selection.max.row - selection.min.row + 1;
      const selCols = selection.max.col - selection.min.col + 1;
      return {
        requestedRows: selRows,
        rows: capRows(selRows, table.options.maxClipboardRows),
        cols: selCols,
        allRows: selRows === data.length,
        allCols: selCols === columns.length,
        columnIds: collectColumnIds(
          columns,
          selection.min.col,
          selection.max.col + 1,
        ),
        includeHeaders,
      };
    };

    table.copySelection = async (options?: CopySelectionOptions) => {
      const selection = table.getSelection?.();
      if (!selection) return;
      const includeHeaders = resolveIncludeHeaders(options?.includeHeaders);

      await writeSelectionToClipboard(includeHeaders);

      const info = buildCopyInfo(includeHeaders);
      if (info) table.options.onClipboardCopy?.(info);
    };

    table.applyPaste = async (text: string) => {
      const selection = table.getSelection?.();
      if (!selection) return;
      if (table.options.readOnly) return;
      if (!text) return;

      const columns = table.getVisibleLeafColumns();
      const data = getData();
      const createRow = table.options.createRow;
      const onDataChange = table.options.onDataChange;
      if (!createRow || !onDataChange) return;

      const clipboardRows = text.split("\n").map((row) => row.split("\t"));
      const pasteRows = clipboardRows.length;
      const pasteCols = Math.max(...clipboardRows.map((r) => r.length));

      const sortedRows = table.getRowModel().rows;
      const { targetRows, targetCols, writtenCols, requestedRows } =
        resolvePasteBounds(
          selection,
          { rows: pasteRows, cols: pasteCols },
          columns.length,
          sortedRows.length,
          table.options,
        );
      if (targetRows === 0) return;

      const dataIndexAt = createDataIndexResolver(table, sortedRows);
      const patchRow: PatchRowFn = table.options.patchRow ?? defaultPatchRow;
      const newData = [...data];

      const yieldIfSliceElapsed = createTimeSlicer();
      for (let i = 0; i < targetRows; i++) {
        await yieldIfSliceElapsed();

        const visualRow = selection.min.row + i;
        let dataIdx: number;
        if (visualRow < sortedRows.length) {
          dataIdx = dataIndexAt(visualRow);
        } else {
          newData.push(createRow());
          dataIdx = newData.length - 1;
        }

        const clipboardRow = clipboardRows[i % pasteRows] ?? [];
        const existing = newData[dataIdx] ?? createRow();
        newData[dataIdx] = patchRow(
          existing,
          collectRowPatches(
            clipboardRow,
            columns,
            selection.min.col,
            targetCols,
            dataIdx,
            existing,
          ),
        );
      }

      await onDataChange(newData);

      table.options.onClipboardPaste?.({
        requestedRows,
        rows: targetRows,
        cols: writtenCols,
        allRows:
          selection.min.row === 0 &&
          selection.min.row + targetRows >= newData.length,
        allCols: selection.min.col === 0 && writtenCols === columns.length,
        columnIds: collectColumnIds(
          columns,
          selection.min.col,
          selection.min.col + writtenCols,
        ),
      });
    };

    table.pasteSelection = async () => {
      const selection = table.getSelection?.();
      if (!selection || table.options.readOnly) return;
      try {
        const text = await navigator.clipboard.readText();
        await table.applyPaste(text);
      } catch {
        // Clipboard access denied or other error
      }
    };

    table.handleCopyEvent = (e: React.ClipboardEvent) => {
      const selection = table.getSelection?.();
      if (!selection) return;
      e.preventDefault();
      void table.copySelection();
    };

    table.handlePasteEvent = (e: React.ClipboardEvent) => {
      const selection = table.getSelection?.();
      if (!selection) return;
      e.preventDefault();
      // Read synchronously from the ClipboardEvent. Going through
      // navigator.clipboard.readText() can trigger an async permission
      // check that steals window focus and breaks document-level
      // keyboard shortcuts (undo/redo) until the grid is re-focused.
      const text = e.clipboardData.getData("text/plain");
      void table.applyPaste(text);
    };
  },

  createColumn: <TData extends RowData>(
    column: Column<TData, unknown>,
    _table: Table<TData>,
  ): void => {
    column.getCopyValue = (value: unknown) => {
      const fn = column.columnDef.meta?.copyValue;
      return fn ? fn(value) : String(value ?? "");
    };

    column.getPasteValue = (text: string, row: TData) => {
      const fn = column.columnDef.meta?.pasteValue;
      return fn ? fn(text, row) : text;
    };
  },
};
