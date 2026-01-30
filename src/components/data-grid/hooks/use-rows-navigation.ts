import { useCallback } from "react";
import { CellPosition } from "../types";

type UseRowsNavigationOptions = {
  activeCell: CellPosition | null;
  colCount: number;
  isEditing: boolean;
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
  selectRow: (rowIndex: number, extend?: boolean) => void;
  selectColumn: (colIndex: number) => void;
  selectAll: () => void;
  clearSelection: () => void;
  blurGrid: () => void;
  visibleRowCount: number;
};

export function useRowsNavigation({
  activeCell,
  colCount,
  isEditing,
  moveActiveCell,
  moveToRowStart,
  moveToRowEnd,
  moveToGridStart,
  moveToGridEnd,
  moveByPage,
  selectRow,
  selectColumn,
  selectAll,
  clearSelection,
  blurGrid,
  visibleRowCount,
}: UseRowsNavigationOptions) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Don't handle navigation while editing - let it bubble up
      if (isEditing) return;

      const isMod = e.ctrlKey || e.metaKey;
      const atLeftEdge = activeCell?.col === 0;
      const atRightEdge = activeCell?.col === colCount - 1;

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
          if (!activeCell) return; // Let browser handle

          const isTabOut =
            (e.shiftKey && atLeftEdge) || (!e.shiftKey && atRightEdge);

          if (isTabOut) {
            clearSelection();
            blurGrid();
            return; // Let browser handle tab out
          }

          e.preventDefault();
          moveActiveCell(e.shiftKey ? "left" : "right");
          break;
        }

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

        // Let other keys bubble up to parent for editing handling
      }
    },
    [
      isEditing,
      activeCell,
      colCount,
      moveActiveCell,
      moveToRowStart,
      moveToRowEnd,
      moveToGridStart,
      moveToGridEnd,
      moveByPage,
      visibleRowCount,
      selectRow,
      selectColumn,
      selectAll,
      clearSelection,
      blurGrid,
    ],
  );

  return handleKeyDown;
}
