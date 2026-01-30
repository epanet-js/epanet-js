import { useCallback } from "react";
import { CellPosition, GridColumn, GridSelection } from "../types";

type UseKeyboardNavigationOptions<TData extends Record<string, unknown>> = {
  activeCell: CellPosition | null;
  selection: GridSelection | null;
  isEditing: boolean;
  isFullRowSelected: boolean;
  columns: GridColumn[];
  data: TData[];
  onChange: (data: TData[]) => void;
  lockRows: boolean;
  moveActiveCell: (
    direction: "up" | "down" | "left" | "right",
    extend?: boolean,
  ) => void;
  moveToRowStart: (extend?: boolean) => void;
  moveToRowEnd: (extend?: boolean) => void;
  moveToGridStart: (extend?: boolean) => void;
  moveToGridEnd: (extend?: boolean) => void;
  moveByPage: (
    direction: "up" | "down",
    pageSize: number,
    extend?: boolean,
  ) => void;
  setSelection: (selection: GridSelection | null) => void;
  selectRow: (rowIndex: number, extend?: boolean) => void;
  selectColumn: (colIndex: number) => void;
  selectAll: () => void;
  startEditing: () => void;
  stopEditing: () => void;
  clearSelection: () => void;
  blurGrid: () => void;
  visibleRowCount: number;
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
  moveToRowStart,
  moveToRowEnd,
  moveToGridStart,
  moveToGridEnd,
  moveByPage,
  setSelection,
  selectRow,
  selectColumn,
  selectAll,
  startEditing,
  stopEditing,
  clearSelection,
  blurGrid,
  visibleRowCount,
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
      const atLeftEdge = activeCell?.col === 0;
      const atRightEdge = activeCell?.col === columns.length - 1;
      const isTabOut =
        (e.shiftKey && atLeftEdge) || (!e.shiftKey && atRightEdge);

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
        } else if (e.key !== "Escape") {
          return;
        }
      }

      const isMod = e.ctrlKey || e.metaKey;

      // https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/grid_role#keyboard_interactions
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

        case "Home":
          e.preventDefault();
          if (isMod) {
            moveToGridStart(e.shiftKey);
          } else {
            moveToRowStart(e.shiftKey);
          }
          break;

        case "End":
          e.preventDefault();
          if (isMod) {
            moveToGridEnd(e.shiftKey);
          } else {
            moveToRowEnd(e.shiftKey);
          }
          break;

        case "PageUp":
          e.preventDefault();
          moveByPage("up", visibleRowCount, e.shiftKey);
          break;

        case "PageDown":
          e.preventDefault();
          moveByPage("down", visibleRowCount, e.shiftKey);
          break;

        case "Tab": {
          // No active cell - let browser handle tab
          if (!activeCell) {
            return;
          }

          // Release focus when tabbing out of the grid
          if (isTabOut) {
            clearSelection();
            blurGrid();
            return; // Let browser handle tab
          }

          e.preventDefault();
          moveActiveCell(e.shiftKey ? "left" : "right");
          break;
        }

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
          if (isEditing) {
            e.preventDefault();
            stopEditing();
          } else if (selection) {
            e.preventDefault();
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

        case " ": // Space
          if (e.shiftKey && activeCell) {
            e.preventDefault();
            selectRow(activeCell.row);
          } else if (isMod && activeCell) {
            e.preventDefault();
            selectColumn(activeCell.col);
          }
          break;

        case "a":
        case "A":
          if (isMod) {
            e.preventDefault();
            selectAll();
          }
          break;

        default:
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
      moveActiveCell,
      moveToRowStart,
      moveToRowEnd,
      moveToGridStart,
      moveToGridEnd,
      moveByPage,
      visibleRowCount,
      setSelection,
      selectRow,
      selectColumn,
      selectAll,
      startEditing,
      stopEditing,
      clearSelection,
      blurGrid,
      handleDelete,
    ],
  );

  return { handleKeyDown };
}
