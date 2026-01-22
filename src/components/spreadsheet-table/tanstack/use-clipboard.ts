import { useCallback } from "react";
import { SpreadsheetColumnDef, SpreadsheetSelection } from "./types";

type UseClipboardOptions<TData extends Record<string, unknown>> = {
  selection: SpreadsheetSelection | null;
  columns: SpreadsheetColumnDef<TData, unknown>[];
  data: TData[];
  onChange: (data: TData[]) => void;
};

export function useClipboard<TData extends Record<string, unknown>>({
  selection,
  columns,
  data,
  onChange,
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
        const accessorKey = (column as { accessorKey?: string }).accessorKey;
        if (!accessorKey) {
          cells.push("");
          continue;
        }

        const value = (row as Record<string, unknown>)[accessorKey];
        const copyValue = column.meta?.copyValue;
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
    if (!selection) return;

    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;

      const clipboardRows = text.split("\n").map((row) => row.split("\t"));
      const newData = [...data];

      for (let i = 0; i < clipboardRows.length; i++) {
        const rowIndex = selection.min.row + i;
        if (rowIndex >= data.length) break;

        const clipboardRow = clipboardRows[i];
        const newRow = { ...newData[rowIndex] };

        for (let j = 0; j < clipboardRow.length; j++) {
          const colIndex = selection.min.col + j;
          if (colIndex >= columns.length) break;

          const column = columns[colIndex];
          if (column.meta?.disabled) continue;

          const accessorKey = (column as { accessorKey?: string }).accessorKey;
          if (!accessorKey) continue;

          const pasteValue = column.meta?.pasteValue;
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
  }, [selection, columns, data, onChange]);

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
