import { useCallback } from "react";
import { CellPosition, EditMode } from "../types";

type UseRowsNavigationOptions = {
  activeCell: CellPosition | null;
  rowCount: number;
  colCount: number;
  editMode: EditMode;
  setActiveCell: (cell: CellPosition, extend?: boolean) => void;
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
  rowCount,
  colCount,
  editMode,
  setActiveCell,
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
          if (activeCell) {
            if (shouldPreventDefault) e.preventDefault();
            const newRow = Math.max(0, activeCell.row - 1);
            setActiveCell({ col: activeCell.col, row: newRow }, e.shiftKey);
          }
          break;

        case "ArrowDown":
          if (activeCell) {
            if (shouldPreventDefault) e.preventDefault();
            const newRow = Math.min(rowCount - 1, activeCell.row + 1);
            setActiveCell({ col: activeCell.col, row: newRow }, e.shiftKey);
          }
          break;

        case "ArrowLeft":
          if (activeCell) {
            if (shouldPreventDefault) e.preventDefault();
            const newCol = Math.max(0, activeCell.col - 1);
            setActiveCell({ col: newCol, row: activeCell.row }, e.shiftKey);
          }
          break;

        case "ArrowRight":
          if (activeCell) {
            if (shouldPreventDefault) e.preventDefault();
            const newCol = Math.min(colCount - 1, activeCell.col + 1);
            setActiveCell({ col: newCol, row: activeCell.row }, e.shiftKey);
          }
          break;

        case "Home":
          e.preventDefault();
          if (isMod) {
            // Move to grid start
            setActiveCell({ col: 0, row: 0 }, e.shiftKey);
          } else if (activeCell) {
            // Move to row start
            setActiveCell({ col: 0, row: activeCell.row }, e.shiftKey);
          }
          break;

        case "End":
          e.preventDefault();
          if (isMod) {
            // Move to grid end
            setActiveCell({ col: colCount - 1, row: rowCount - 1 }, e.shiftKey);
          } else if (activeCell) {
            // Move to row end
            setActiveCell(
              { col: colCount - 1, row: activeCell.row },
              e.shiftKey,
            );
          }
          break;

        case "PageUp":
          if (activeCell) {
            e.preventDefault();
            const newRow = Math.max(0, activeCell.row - visibleRowCount);
            setActiveCell({ col: activeCell.col, row: newRow }, e.shiftKey);
          }
          break;

        case "PageDown":
          if (activeCell) {
            e.preventDefault();
            const newRow = Math.min(
              rowCount - 1,
              activeCell.row + visibleRowCount,
            );
            setActiveCell({ col: activeCell.col, row: newRow }, e.shiftKey);
          }
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
          const newCol = e.shiftKey
            ? Math.max(0, activeCell.col - 1)
            : Math.min(colCount - 1, activeCell.col + 1);
          setActiveCell({ col: newCol, row: activeCell.row });
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
      rowCount,
      colCount,
      setActiveCell,
      visibleRowCount,
      selectCells,
      clearSelection,
      blurGrid,
    ],
  );

  return handleKeyDown;
}
