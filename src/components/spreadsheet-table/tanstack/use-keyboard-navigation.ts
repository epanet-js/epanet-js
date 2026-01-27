import { useCallback } from "react";
import { CellPosition, SpreadsheetColumn, SpreadsheetSelection } from "./types";

type UseKeyboardNavigationOptions<TData extends Record<string, unknown>> = {
  activeCell: CellPosition | null;
  selection: SpreadsheetSelection | null;
  isEditing: boolean;
  isFullRowSelected: boolean;
  columns: SpreadsheetColumn[];
  data: TData[];
  onChange: (data: TData[]) => void;
  lockRows: boolean;
  moveActiveCell: (
    direction: "up" | "down" | "left" | "right",
    extend?: boolean,
  ) => void;
  setActiveCell: (cell: CellPosition, extend?: boolean) => void;
  startEditing: () => void;
  stopEditing: () => void;
};

export function useKeyboardNavigation<TData extends Record<string, unknown>>({
  activeCell,
  selection,
  isEditing,
  isFullRowSelected,
  columns,
  data,
  onChange,
  lockRows,
  moveActiveCell,
  startEditing,
  stopEditing,
}: UseKeyboardNavigationOptions<TData>) {
  const handleDelete = useCallback(() => {
    if (!selection) return;

    // If full row(s) selected and lockRows is false, delete rows
    if (isFullRowSelected && !lockRows) {
      const minRow = selection.min.row;
      const maxRow = selection.max.row;
      onChange([...data.slice(0, minRow), ...data.slice(maxRow + 1)]);
      return;
    }

    // Otherwise, clear cell values
    const newData = data.map((row, rowIndex) => {
      if (rowIndex < selection.min.row || rowIndex > selection.max.row) {
        return row;
      }

      const newRow = { ...row };
      for (
        let colIndex = selection.min.col;
        colIndex <= selection.max.col;
        colIndex++
      ) {
        const column = columns[colIndex];
        if (column?.disabled) continue;

        const accessorKey = column?.accessorKey;
        if (!accessorKey) continue;

        const deleteValue = column.deleteValue;
        const value =
          typeof deleteValue === "function" ? deleteValue() : deleteValue;
        (newRow as Record<string, unknown>)[accessorKey] = value ?? null;
      }
      return newRow;
    });

    onChange(newData);
  }, [selection, isFullRowSelected, lockRows, data, columns, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // If we're editing, let the cell handle most keys
      if (isEditing) {
        if (e.key === "Escape") {
          e.preventDefault();
          stopEditing();
        } else if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          stopEditing();
          moveActiveCell("down");
        } else if (e.key === "Tab") {
          e.preventDefault();
          stopEditing();
          moveActiveCell(e.shiftKey ? "left" : "right");
        }
        return;
      }

      // Navigation keys
      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          moveActiveCell("up", e.shiftKey);
          break;

        case "ArrowDown":
          e.preventDefault();
          moveActiveCell("down", e.shiftKey);
          break;

        case "ArrowLeft":
          e.preventDefault();
          moveActiveCell("left", e.shiftKey);
          break;

        case "ArrowRight":
          e.preventDefault();
          moveActiveCell("right", e.shiftKey);
          break;

        case "Tab":
          e.preventDefault();
          moveActiveCell(e.shiftKey ? "left" : "right");
          break;

        case "Enter":
          e.preventDefault();
          if (activeCell) {
            const column = columns[activeCell.col];
            if (!column?.disabled && !column?.disableKeys) {
              startEditing();
            }
          }
          break;

        case "Escape":
          e.preventDefault();
          stopEditing();
          break;

        case "Delete":
        case "Backspace":
          e.preventDefault();
          handleDelete();
          break;

        default:
          // Start editing on alphanumeric key press
          if (
            activeCell &&
            e.key.length === 1 &&
            !e.ctrlKey &&
            !e.metaKey &&
            !e.altKey
          ) {
            const column = columns[activeCell.col];
            if (!column?.disabled && !column?.disableKeys) {
              startEditing();
              // Note: The actual character will be handled by the cell input
            }
          }
          break;
      }
    },
    [
      isEditing,
      activeCell,
      columns,
      moveActiveCell,
      startEditing,
      stopEditing,
      handleDelete,
    ],
  );

  return { handleKeyDown };
}
