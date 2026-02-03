import { useCallback } from "react";
import { CellPosition, EditMode } from "../types";

type UseRowsNavigationOptions = {
  activeCell: CellPosition | null;
  colCount: number;
  editMode: EditMode;
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
  selectCells: (options?: {
    colIndex?: number;
    rowIndex?: number;
    extend?: boolean;
  }) => void;
  clearSelection: () => void;
  blurGrid: () => void;
  visibleRowCount: number;
};

export function useRowsNavigation({
  activeCell,
  colCount,
  editMode,
  moveActiveCell,
  moveToRowStart,
  moveToRowEnd,
  moveToGridStart,
  moveToGridEnd,
  moveByPage,
  selectCells,
  clearSelection,
  blurGrid,
  visibleRowCount,
}: UseRowsNavigationOptions) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // In full edit mode, skip navigation - let arrow keys move cursor in input
      if (editMode === "full") {
        return;
      }

      const isMod = e.ctrlKey || e.metaKey;
      const atLeftEdge = activeCell?.col === 0;
      const atRightEdge = activeCell?.col === colCount - 1;

      // In quick edit mode, handle arrow keys but don't preventDefault
      // This lets the event bubble to use-grid-editing for commit handling
      const shouldPreventDefault = !editMode;

      switch (e.key) {
        case "ArrowUp":
          if (shouldPreventDefault) e.preventDefault();
          moveActiveCell("up", e.shiftKey);
          break;

        case "ArrowDown":
          if (shouldPreventDefault) e.preventDefault();
          moveActiveCell("down", e.shiftKey);
          break;

        case "ArrowLeft":
          if (shouldPreventDefault) e.preventDefault();
          moveActiveCell("left", e.shiftKey);
          break;

        case "ArrowRight":
          if (shouldPreventDefault) e.preventDefault();
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
            selectCells({ rowIndex: activeCell.row });
          } else if (isMod && activeCell) {
            e.preventDefault();
            selectCells({ colIndex: activeCell.col });
          }
          break;

        case "a":
        case "A":
          if (isMod) {
            e.preventDefault();
            selectCells();
          }
          break;

        // Let other keys bubble up to parent for editing handling
      }
    },
    [
      editMode,
      activeCell,
      colCount,
      moveActiveCell,
      moveToRowStart,
      moveToRowEnd,
      moveToGridStart,
      moveToGridEnd,
      moveByPage,
      visibleRowCount,
      selectCells,
      clearSelection,
      blurGrid,
    ],
  );

  return handleKeyDown;
}
