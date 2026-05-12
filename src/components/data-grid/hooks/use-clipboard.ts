import { useCallback } from "react";
import { GridColumn, GridSelection } from "../types";

type UseClipboardOptions<TData extends Record<string, unknown>> = {
  selection: GridSelection | null;
  columns: GridColumn[];
  data: TData[];
  onChange: (data: TData[]) => void;
  createRow: () => TData;
  readOnly?: boolean;
  onCopy?: (info: {
    rows: number;
    cols: number;
    allRows: boolean;
    allCols: boolean;
    columnIds: string[];
    canIncludeHeaders: boolean;
    copyWithHeaders: () => Promise<void>;
  }) => void;
  onPaste?: (info: {
    rows: number;
    cols: number;
    allRows: boolean;
    allCols: boolean;
    columnIds: string[];
  }) => void;
};

export function useClipboard<TData extends Record<string, unknown>>({
  selection,
  columns,
  data,
  onChange,
  createRow,
  readOnly = false,
  onCopy,
  onPaste,
}: UseClipboardOptions<TData>) {
  const writeSelectionToClipboard = useCallback(
    async (includeHeaders: boolean) => {
      if (!selection) return;

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
        let rowIndex = selection.min.row;
        rowIndex <= selection.max.row;
        rowIndex++
      ) {
        const row = data[rowIndex];
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
    },
    [selection, columns, data],
  );

  const copyToClipboard = useCallback(async () => {
    if (!selection) return;

    await writeSelectionToClipboard(false);

    const selRows = selection.max.row - selection.min.row + 1;
    const selCols = selection.max.col - selection.min.col + 1;
    const allRows = selRows === data.length;
    const allCols = selCols === columns.length;
    const columnIds: string[] = [];
    for (let c = selection.min.col; c <= selection.max.col; c++) {
      const key = columns[c]?.accessorKey;
      if (key) columnIds.push(key);
    }
    onCopy?.({
      rows: selRows,
      cols: selCols,
      allRows,
      allCols,
      columnIds,
      canIncludeHeaders: allRows,
      copyWithHeaders: () => writeSelectionToClipboard(true),
    });
  }, [selection, columns, data, onCopy, writeSelectionToClipboard]);

  const applyPaste = useCallback(
    (text: string) => {
      if (!selection || readOnly) return;
      if (!text) return;

      const clipboardRows = text.split("\n").map((row) => row.split("\t"));
      const pasteRows = clipboardRows.length;
      const pasteCols = Math.max(...clipboardRows.map((r) => r.length));

      const selRows = selection.max.row - selection.min.row + 1;
      const selCols = selection.max.col - selection.min.col + 1;

      // Tile the clipboard block to cover the full selection when the
      // selection is larger; otherwise use the clipboard dimensions, which
      // may extend past a single-cell selection.
      const targetRows = Math.max(selRows, pasteRows);
      const targetCols = Math.max(selCols, pasteCols);

      const newData = [...data];
      const requiredRows = selection.min.row + targetRows;
      while (newData.length < requiredRows) {
        newData.push(createRow());
      }

      for (let i = 0; i < targetRows; i++) {
        const rowIndex = selection.min.row + i;
        const clipboardRow = clipboardRows[i % pasteRows];
        const newRow = { ...newData[rowIndex] };

        for (let j = 0; j < targetCols; j++) {
          const colIndex = selection.min.col + j;
          if (colIndex >= columns.length) break;

          const column = columns[colIndex];
          if (column?.disabled) continue;

          const accessorKey = column?.accessorKey;
          if (!accessorKey) continue;

          const cellText = clipboardRow[j % clipboardRow.length] ?? "";
          const pasteValue = column.pasteValue;
          const value = pasteValue ? pasteValue(cellText) : cellText;
          (newRow as Record<string, unknown>)[accessorKey] = value;
        }

        newData[rowIndex] = newRow;
      }

      onChange(newData);

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
      onPaste?.({
        rows: targetRows,
        cols: writtenCols,
        allRows:
          selection.min.row === 0 &&
          selection.min.row + targetRows >= newData.length,
        allCols: selection.min.col === 0 && writtenCols === columns.length,
        columnIds,
      });
    },
    [selection, columns, data, onChange, createRow, readOnly, onPaste],
  );

  const pasteFromClipboard = useCallback(async () => {
    if (!selection || readOnly) return;

    try {
      const text = await navigator.clipboard.readText();
      applyPaste(text);
    } catch {
      // Clipboard access denied or other error
    }
  }, [selection, readOnly, applyPaste]);

  const handleCopy = useCallback(
    (e: React.ClipboardEvent) => {
      if (!selection) return;
      e.preventDefault();
      void copyToClipboard();
    },
    [selection, copyToClipboard],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (!selection) return;
      e.preventDefault();
      // Read synchronously from the ClipboardEvent. Going through
      // navigator.clipboard.readText() can trigger an async permission check
      // that steals window focus, which then breaks document-level keyboard
      // shortcuts (undo/redo) until the grid is re-focused.
      const text = e.clipboardData.getData("text/plain");
      applyPaste(text);
    },
    [selection, applyPaste],
  );

  return { handleCopy, handlePaste, copyToClipboard, pasteFromClipboard };
}
