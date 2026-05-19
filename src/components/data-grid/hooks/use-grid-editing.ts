import { useCallback } from "react";
import type { Column, Table } from "@tanstack/react-table";
import { CellPosition, EditMode, GridSelection } from "../types";
import { isFullRowSelected } from "./use-selection";

type UseGridEditingOptions<TData extends Record<string, unknown>> = {
  table: Table<TData>;
  activeCell: CellPosition | null;
  selection: GridSelection | null;
  editMode: EditMode;
  data: TData[];
  onChange: (data: TData[]) => void;
  rowCount: number;
  colCount: number;
  selectCells: (options?: {
    colIndex?: number;
    rowIndex?: number;
    extend?: boolean;
  }) => void;
  startEditing: (mode: "quick" | "full") => void;
  stopEditing: () => void;
  clearSelection: () => void;
  blurGrid: () => void;
  onAddRow?: () => void;
};

export function useGridEditing<TData extends Record<string, unknown>>({
  table,
  activeCell,
  selection,
  editMode,
  data,
  onChange,
  rowCount,
  colCount,
  selectCells,
  startEditing,
  stopEditing,
  clearSelection,
  blurGrid,
  onAddRow,
}: UseGridEditingOptions<TData>) {
  const handleDelete = useCallback(() => {
    if (!selection || table.options.readOnly) return;

    if (isFullRowSelected(selection, colCount)) {
      onChange(deleteRows(data, selection));
      return;
    }

    onChange(clearCells(data, selection, table.getVisibleLeafColumns()));
  }, [selection, table, colCount, data, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const atLeftEdge = activeCell?.col === 0;
      const atRightEdge = activeCell?.col === colCount - 1;
      const isTabOut =
        (e.shiftKey && atLeftEdge) || (!e.shiftKey && atRightEdge);

      // Handle keys while editing
      if (editMode) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          stopEditing();
          if (activeCell) {
            if (activeCell.row === rowCount - 1 && onAddRow) {
              onAddRow();
            } else {
              const newRow = Math.min(rowCount - 1, activeCell.row + 1);
              selectCells({ colIndex: activeCell.col, rowIndex: newRow });
            }
          }
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
          if (activeCell) {
            const newCol = e.shiftKey
              ? Math.max(0, activeCell.col - 1)
              : Math.min(colCount - 1, activeCell.col + 1);
            selectCells({ colIndex: newCol, rowIndex: activeCell.row });
          }
          return;
        } else if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          stopEditing();
          return;
        } else if (
          editMode === "quick" &&
          ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
        ) {
          // In quick mode, commit on arrow keys (navigation handled by use-rows-navigation)
          e.preventDefault();
          stopEditing();
          return;
        }
        // In full mode, arrow keys are handled by the input (cursor movement)
        // Let other keys pass through to the cell input
        return;
      }

      // Handle keys when not editing (these bubble up from Rows if not handled)
      switch (e.key) {
        case "Enter":
          e.preventDefault();
          if (activeCell) {
            const column = table.getVisibleLeafColumns()[activeCell.col];
            if (column && !column.isReadOnly(activeCell.row)) {
              startEditing("full");
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
              selectCells({
                colIndex: activeCell.col,
                rowIndex: activeCell.row,
              });
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
          // Character input starts editing in quick mode
          if (
            activeCell &&
            e.key.length === 1 &&
            !e.ctrlKey &&
            !e.metaKey &&
            !e.altKey
          ) {
            const column = table.getVisibleLeafColumns()[activeCell.col];
            if (column && !column.isReadOnly(activeCell.row)) {
              startEditing("quick");
            }
          }
          break;
      }
    },
    [
      editMode,
      activeCell,
      selection,
      table,
      rowCount,
      colCount,
      selectCells,
      startEditing,
      stopEditing,
      clearSelection,
      blurGrid,
      handleDelete,
      onAddRow,
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
  columns: Column<TData, unknown>[],
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
      if (!column || column.isReadOnly(rowIndex)) continue;

      const accessorKey = column.id;
      if (!accessorKey) continue;

      const deleteValue = column.getDeleteValue();
      const value =
        typeof deleteValue === "function" ? deleteValue() : deleteValue;
      (newRow as Record<string, unknown>)[accessorKey] = value ?? null;
    }
    return newRow;
  });
}
