import { useCallback } from "react";
import { GridColumn, GridSelection } from "../types";

type UseClipboardOptions<TData extends Record<string, unknown>> = {
  selection: GridSelection | null;
  columns: GridColumn[];
  data: TData[];
  onChange: (data: TData[]) => void;
  createRow: () => TData;
  readOnly?: boolean;
};

export function useClipboard<TData extends Record<string, unknown>>({
  selection,
  columns,
  data,
  onChange,
  createRow,
  readOnly = false,
}: UseClipboardOptions<TData>) {
  const copyToClipboard = useCallback(async () => {
    if (!selection) return;

    const rows: string[] = [];

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

    const text = rows.join("\n");
    await navigator.clipboard.writeText(text);
  }, [selection, columns, data]);

  const pasteFromClipboard = useCallback(async () => {
    if (!selection || readOnly) return;

    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;

      const clipboardRows = text.split("\n").map((row) => row.split("\t"));
      const newData = [...data];

      // Extend data array if clipboard content exceeds current size
      const requiredRows = selection.min.row + clipboardRows.length;
      while (newData.length < requiredRows) {
        newData.push(createRow());
      }

      for (let i = 0; i < clipboardRows.length; i++) {
        const rowIndex = selection.min.row + i;

        const clipboardRow = clipboardRows[i];
        const newRow = { ...newData[rowIndex] };

        for (let j = 0; j < clipboardRow.length; j++) {
          const colIndex = selection.min.col + j;
          if (colIndex >= columns.length) break;

          const column = columns[colIndex];
          if (column?.disabled) continue;

          const accessorKey = column?.accessorKey;
          if (!accessorKey) continue;

          const pasteValue = column.pasteValue;
          const value = pasteValue
            ? pasteValue(clipboardRow[j])
            : clipboardRow[j];
          (newRow as Record<string, unknown>)[accessorKey] = value;
        }

        newData[rowIndex] = newRow;
      }

      onChange(newData);
    } catch {
      // Clipboard access denied or other error
    }
  }, [selection, columns, data, onChange, createRow, readOnly]);

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
      void pasteFromClipboard();
    },
    [selection, pasteFromClipboard],
  );

  return { handleCopy, handlePaste, copyToClipboard, pasteFromClipboard };
}
