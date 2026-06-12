import type {
  Column,
  RowData,
  Table,
  TableFeature,
} from "@tanstack/react-table";
import { defaultPatchRow, type PatchRowFn } from "../utils/patch-row";
import {
  isLazyRowModel,
  LAZY_ROW_MODEL_THRESHOLD,
} from "../utils/lazy-core-row-model";
import type { GridSelection } from "../types";

export type CopySelectionOptions = {
  includeHeaders?: boolean;
};

export type ClipboardCopyInfo = {
  selectedRows: number;
  copiedRows: number;
  cols: number;
  allRows: boolean;
  allCols: boolean;
  columnIds: string[];
};

export type ClipboardPasteInfo = {
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
    createRow?: () => TData;
    onClipboardCopy?: (info: ClipboardCopyInfo) => void;
    onClipboardPaste?: (info: ClipboardPasteInfo) => void;
    onDataChange?: (data: TData[]) => void;
    patchRow?: PatchRowFn;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    copyValue?: (value: TValue) => string;
    // Returns undefined to signal "skip this cell" (e.g. pasted value
    // fails validation). The clipboard feature leaves the cell unchanged.
    // `row` is the destination row's data — useful for row-aware validators
    // (e.g. uniqueness checks that need to exclude the current row's id).
    pasteValue?: (text: string, row: TData) => TValue | undefined;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Table<TData extends RowData> {
    copySelection: (options?: CopySelectionOptions) => Promise<void>;
    pasteSelection: () => Promise<void>;
    handleCopyEvent: (e: React.ClipboardEvent) => void;
    handlePasteEvent: (e: React.ClipboardEvent) => void;
    applyPaste: (text: string) => void;
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

export const ClipboardFeature: TableFeature = {
  createTable: <TData extends RowData>(table: Table<TData>): void => {
    const getData = (): TData[] => table.options.data;

    // Max data rows a single copy will read. On lazy tables, copying the whole
    // selection would materialize every row (the freeze the lazy model avoids),
    // so we cap at the working-set size and let callers point users to Export.
    const copyRowCap = (): number =>
      isLazyRowModel(table) ? LAZY_ROW_MODEL_THRESHOLD : Infinity;

    const lastCopyRow = (selection: GridSelection): number =>
      Math.min(selection.max.row, selection.min.row + copyRowCap() - 1);

    const writeSelectionToClipboard = async (includeHeaders: boolean) => {
      const selection = table.getSelection?.();
      if (!selection) return;

      const columns = table.getVisibleLeafColumns();
      const rowModel = table.getRowModel();
      const rows: string[] = [];

      if (includeHeaders) {
        const headers: string[] = [];
        for (
          let colIndex = selection.min.col;
          colIndex <= selection.max.col;
          colIndex++
        ) {
          headers.push(headerText(columns[colIndex]));
        }
        rows.push(headers.join("\t"));
      }

      const maxRow = lastCopyRow(selection);
      for (
        let visualRow = selection.min.row;
        visualRow <= maxRow;
        visualRow++
      ) {
        const tableRow = rowModel.rows[visualRow];
        const cells: string[] = [];

        for (
          let colIndex = selection.min.col;
          colIndex <= selection.max.col;
          colIndex++
        ) {
          const column = columns[colIndex];
          if (!column || !tableRow) {
            cells.push("");
            continue;
          }

          // Read through the row model so computed `accessorFn` columns resolve
          // correctly (reading `row.original[column.id]` would miss them).
          const value = tableRow.getValue(column.id);
          cells.push(column.getCopyValue(value));
        }

        rows.push(cells.join("\t"));
      }

      await navigator.clipboard.writeText(rows.join("\n"));
    };

    const resolveIncludeHeaders = (explicit: boolean | undefined): boolean => {
      if (explicit !== undefined) return explicit;
      return table.options.includeHeadersOnCopy ?? false;
    };

    const buildCopyInfo = (): ClipboardCopyInfo | null => {
      const selection = table.getSelection?.();
      if (!selection) return null;
      const columns = table.getVisibleLeafColumns();
      const data = getData();
      const selRows = selection.max.row - selection.min.row + 1;
      const selCols = selection.max.col - selection.min.col + 1;
      const columnIds: string[] = [];
      for (let c = selection.min.col; c <= selection.max.col; c++) {
        const id = columns[c]?.id;
        if (id) columnIds.push(id);
      }
      return {
        selectedRows: selRows,
        copiedRows: Math.min(selRows, copyRowCap()),
        cols: selCols,
        allRows: selRows === data.length,
        allCols: selCols === columns.length,
        columnIds,
      };
    };

    table.copySelection = async (options?: CopySelectionOptions) => {
      const selection = table.getSelection?.();
      if (!selection) return;
      const includeHeaders = resolveIncludeHeaders(options?.includeHeaders);

      await writeSelectionToClipboard(includeHeaders);

      const info = buildCopyInfo();
      if (info) table.options.onClipboardCopy?.(info);
    };

    table.applyPaste = (text: string) => {
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

      const selRows = selection.max.row - selection.min.row + 1;
      const selCols = selection.max.col - selection.min.col + 1;

      // Tile the clipboard block to cover the full selection when the
      // selection is larger; otherwise use the clipboard dimensions.
      const targetRowsRaw = Math.max(selRows, pasteRows);
      const targetCols = Math.max(selCols, pasteCols);

      const sortedRows = table.getRowModel().rows;
      const visualRowCount = sortedRows.length;

      // Cap the paste to the existing rows unless the consumer opted in to
      // auto-extending. Extra clipboard rows past the end are dropped.
      const remainingVisualRows = visualRowCount - selection.min.row;
      const targetRows = table.options.autoExtendOnPaste
        ? targetRowsRaw
        : Math.min(targetRowsRaw, Math.max(0, remainingVisualRows));

      if (targetRows === 0) return;

      const newData = [...data];

      // Map each visual row position in the paste target to a data-array
      // index. For positions beyond the current row count, append a fresh
      // row (only reached when autoExtendOnPaste is true).
      const dataIndices: number[] = [];
      for (let i = 0; i < targetRows; i++) {
        const visualRow = selection.min.row + i;
        if (visualRow < visualRowCount) {
          dataIndices.push(sortedRows[visualRow].index);
        } else {
          const created = createRow();
          newData.push(created);
          dataIndices.push(newData.length - 1);
        }
      }

      const patchRow: PatchRowFn = table.options.patchRow ?? defaultPatchRow;

      for (let i = 0; i < targetRows; i++) {
        const dataIdx = dataIndices[i];
        const clipboardRow = clipboardRows[i % pasteRows] ?? [];
        const existing = newData[dataIdx] ?? createRow();

        const patches: Record<string, unknown> = {};
        for (let j = 0; j < targetCols; j++) {
          const colIndex = selection.min.col + j;
          if (colIndex >= columns.length) break;

          const column = columns[colIndex];
          if (!column || column.isReadOnly(dataIdx)) continue;

          const cellText = clipboardRow[j % clipboardRow.length] ?? "";
          const pasted = column.getPasteValue(cellText, existing);
          if (pasted === undefined) continue;
          patches[column.id] = pasted;
        }

        newData[dataIdx] = patchRow(existing, patches);
      }

      onDataChange(newData);

      const writtenCols = Math.min(
        targetCols,
        columns.length - selection.min.col,
      );
      const columnIds: string[] = [];
      for (
        let c = selection.min.col;
        c < selection.min.col + writtenCols;
        c++
      ) {
        const id = columns[c]?.id;
        if (id) columnIds.push(id);
      }

      table.options.onClipboardPaste?.({
        rows: targetRows,
        cols: writtenCols,
        allRows:
          selection.min.row === 0 &&
          selection.min.row + targetRows >= newData.length,
        allCols: selection.min.col === 0 && writtenCols === columns.length,
        columnIds,
      });
    };

    table.pasteSelection = async () => {
      const selection = table.getSelection?.();
      if (!selection || table.options.readOnly) return;
      try {
        const text = await navigator.clipboard.readText();
        table.applyPaste(text);
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
      table.applyPaste(text);
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
