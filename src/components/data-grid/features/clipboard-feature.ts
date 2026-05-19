import type { RowData, Table, TableFeature } from "@tanstack/react-table";
import { isColumnReadOnly, type GridColumn } from "../types";

export type CopySelectionOptions = {
  includeHeaders?: boolean;
};

export type ClipboardCopyInfo = {
  rows: number;
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
    readOnly?: boolean;
    onClipboardCopy?: (info: ClipboardCopyInfo) => void;
    onClipboardPaste?: (info: ClipboardPasteInfo) => void;
    onDataChange?: (data: TData[]) => void;
    gridColumns?: GridColumn[];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Table<TData extends RowData> {
    copySelection: (options?: CopySelectionOptions) => Promise<void>;
    pasteSelection: () => Promise<void>;
    handleCopyEvent: (e: React.ClipboardEvent) => void;
    handlePasteEvent: (e: React.ClipboardEvent) => void;
    applyPaste: (text: string) => void;
  }
}

export const ClipboardFeature: TableFeature = {
  createTable: <TData extends RowData>(table: Table<TData>): void => {
    const getColumns = (): GridColumn[] => table.options.gridColumns ?? [];
    const getData = (): TData[] => table.options.data;

    // Selection row indices are visual (positions within the sorted row model).
    // Translate to data-array indices when reading from / writing to `data`.
    const visualToDataIndex = (visualRow: number): number => {
      const rows = table.getRowModel().rows;
      return rows[visualRow]?.index ?? visualRow;
    };

    const writeSelectionToClipboard = async (includeHeaders: boolean) => {
      const selection = table.getSelection?.();
      if (!selection) return;

      const columns = getColumns();
      const data = getData();
      const rows: string[] = [];

      if (includeHeaders) {
        const headers: string[] = [];
        for (
          let colIndex = selection.min.col;
          colIndex <= selection.max.col;
          colIndex++
        ) {
          headers.push(columns[colIndex]?.header ?? "");
        }
        rows.push(headers.join("\t"));
      }

      for (
        let visualRow = selection.min.row;
        visualRow <= selection.max.row;
        visualRow++
      ) {
        const row = data[visualToDataIndex(visualRow)];
        const cells: string[] = [];

        for (
          let colIndex = selection.min.col;
          colIndex <= selection.max.col;
          colIndex++
        ) {
          const column = columns[colIndex];
          const accessorKey = column?.accessorKey;
          if (!accessorKey) {
            cells.push("");
            continue;
          }

          const value = (row as Record<string, unknown>)[accessorKey];
          const copyValue = column.copyValue;
          const stringValue = copyValue
            ? copyValue(value)
            : (value?.toString() ?? "");
          cells.push(stringValue);
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
      const columns = getColumns();
      const data = getData();
      const selRows = selection.max.row - selection.min.row + 1;
      const selCols = selection.max.col - selection.min.col + 1;
      const columnIds: string[] = [];
      for (let c = selection.min.col; c <= selection.max.col; c++) {
        const key = columns[c]?.accessorKey;
        if (key) columnIds.push(key);
      }
      return {
        rows: selRows,
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

      const columns = getColumns();
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

      for (let i = 0; i < targetRows; i++) {
        const dataIdx = dataIndices[i];
        const clipboardRow = clipboardRows[i % pasteRows] ?? [];
        const existing = newData[dataIdx];
        const newRow: Record<string, unknown> = existing
          ? { ...(existing as Record<string, unknown>) }
          : (createRow() as Record<string, unknown>);

        for (let j = 0; j < targetCols; j++) {
          const colIndex = selection.min.col + j;
          if (colIndex >= columns.length) break;

          const column = columns[colIndex];
          if (isColumnReadOnly(column, dataIdx)) continue;

          const accessorKey = column?.accessorKey;
          if (!accessorKey) continue;

          const cellText = clipboardRow[j % clipboardRow.length] ?? "";
          const pasteValue = column.pasteValue;
          const value = pasteValue ? pasteValue(cellText) : cellText;
          newRow[accessorKey] = value;
        }

        newData[dataIdx] = newRow as TData;
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
        const key = columns[c]?.accessorKey;
        if (key) columnIds.push(key);
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
};
