import { useCallback } from "react";
import type { Table } from "@tanstack/react-table";
import { resolveDataIndex } from "../utils/data-index";

type UseGridEditingOptions<TData extends Record<string, unknown>> = {
  table: Table<TData>;
  selectCells: (options?: {
    colIndex?: number;
    rowIndex?: number;
    extend?: boolean;
  }) => void;
  clearSelection: () => void;
  blurGrid: () => void;
  onAddRow?: () => void;
};

export function useGridEditing<TData extends Record<string, unknown>>({
  table,
  selectCells,
  clearSelection,
  blurGrid,
  onAddRow,
}: UseGridEditingOptions<TData>) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const activeCell = table.getActiveCell();
      const editMode = table.getEditMode();
      const colCount = table.getVisibleLeafColumns().length;
      const rowCount = table.getRowModel().rows.length;
      const atLeftEdge = activeCell?.col === 0;
      const atRightEdge = activeCell?.col === colCount - 1;
      const isTabOut =
        (e.shiftKey && atLeftEdge) || (!e.shiftKey && atRightEdge);

      // Handle keys while editing
      if (editMode) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          table.stopEditing();
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
            table.stopEditing();
            clearSelection();
            blurGrid();
            return; // Let browser handle tab
          }

          e.preventDefault();
          table.stopEditing();
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
          table.stopEditing();
          return;
        } else if (
          editMode === "quick" &&
          ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
        ) {
          // In quick mode, commit on arrow keys (navigation handled by use-rows-navigation)
          e.preventDefault();
          table.stopEditing();
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
            if (
              column &&
              !column.isReadOnly(resolveDataIndex(table, activeCell.row))
            ) {
              table.startEditing("full");
            }
          }
          break;

        case "Escape": {
          const selection = table.getSelection();
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
        }

        case "Delete":
        case "Backspace":
          e.preventDefault();
          table.deleteSelection();
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
            if (
              column &&
              !column.isReadOnly(resolveDataIndex(table, activeCell.row))
            ) {
              table.startEditing("quick");
            }
          }
          break;
      }
    },
    [table, selectCells, clearSelection, blurGrid, onAddRow],
  );

  return handleKeyDown;
}
