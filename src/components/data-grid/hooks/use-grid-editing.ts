import { useCallback } from "react";
import { CellPosition, GridColumn, GridSelection } from "../types";

type UseGridEditingOptions<TData extends Record<string, unknown>> = {
  activeCell: CellPosition | null;
  selection: GridSelection | null;
  isEditing: boolean;
  isFullRowSelected: boolean;
  columns: GridColumn[];
  data: TData[];
  onChange: (data: TData[]) => void;
  readOnly: boolean;
  colCount: number;
  moveActiveCell: (
    direction: "up" | "down" | "left" | "right",
    extend?: boolean,
  ) => void;
  setSelection: (selection: GridSelection | null) => void;
  startEditing: () => void;
  stopEditing: () => void;
  clearSelection: () => void;
  blurGrid: () => void;
};

export function useGridEditing<TData extends Record<string, unknown>>({
  activeCell,
  selection,
  isEditing,
  isFullRowSelected,
  columns,
  data,
  onChange,
  readOnly,
  colCount,
  moveActiveCell,
  setSelection,
  startEditing,
  stopEditing,
  clearSelection,
  blurGrid,
}: UseGridEditingOptions<TData>) {
  const handleDelete = useCallback(() => {
    if (!selection || readOnly) return;

    if (isFullRowSelected) {
      onChange(deleteRows(data, selection));
      return;
    }

    onChange(clearCells(data, selection, columns));
  }, [selection, readOnly, isFullRowSelected, data, columns, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const atLeftEdge = activeCell?.col === 0;
      const atRightEdge = activeCell?.col === colCount - 1;
      const isTabOut =
        (e.shiftKey && atLeftEdge) || (!e.shiftKey && atRightEdge);

      // Handle keys while editing
      if (isEditing) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          stopEditing();
          moveActiveCell("down");
          return;
        } else if (e.key === "Tab") {
          if (isTabOut) {
            stopEditing();
            clearSelection();
            blurGrid();
            return; // Let browser handle tab
          }

          e.preventDefault();
          stopEditing();
          moveActiveCell(e.shiftKey ? "left" : "right");
          return;
        } else if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          stopEditing();
          return;
        }
        // Let other keys pass through to the cell input
        return;
      }

      // Handle keys when not editing (these bubble up from Rows if not handled)
      switch (e.key) {
        case "Enter":
          e.preventDefault();
          if (activeCell && !readOnly) {
            const column = columns[activeCell.col];
            if (!column?.disabled && !column?.disableKeys) {
              startEditing();
            }
          }
          break;

        case "Escape":
          if (selection) {
            e.preventDefault();
            e.stopPropagation();
            const isMultiCell =
              selection.min.col !== selection.max.col ||
              selection.min.row !== selection.max.row;

            if (isMultiCell && activeCell) {
              setSelection({ min: activeCell, max: activeCell });
            } else {
              clearSelection();
              blurGrid();
            }
          }
          break;

        case "Delete":
        case "Backspace":
          e.preventDefault();
          handleDelete();
          break;

        default:
          // Character input starts editing
          if (
            activeCell &&
            !readOnly &&
            e.key.length === 1 &&
            !e.ctrlKey &&
            !e.metaKey &&
            !e.altKey
          ) {
            const column = columns[activeCell.col];
            if (!column?.disabled && !column?.disableKeys) {
              startEditing();
            }
          }
          break;
      }
    },
    [
      isEditing,
      activeCell,
      selection,
      columns,
      colCount,
      readOnly,
      moveActiveCell,
      setSelection,
      startEditing,
      stopEditing,
      clearSelection,
      blurGrid,
      handleDelete,
    ],
  );

  return handleKeyDown;
}

function deleteRows<TData extends Record<string, unknown>>(
  data: TData[],
  selection: GridSelection,
): TData[] {
  const minRow = selection.min.row;
  const maxRow = selection.max.row;
  return [...data.slice(0, minRow), ...data.slice(maxRow + 1)];
}

function clearCells<TData extends Record<string, unknown>>(
  data: TData[],
  selection: GridSelection,
  columns: GridColumn[],
): TData[] {
  return data.map((row, rowIndex) => {
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
}
