import { useCallback, useEffect, useMemo, useState } from "react";
import { CellPosition, SelectionState, GridSelection } from "../types";

export function isFullRowSelected(
  selection: GridSelection | null,
  colCount: number,
): boolean {
  if (!selection) return false;
  return selection.min.col === 0 && selection.max.col === colCount - 1;
}

export function isCellSelected(
  selection: GridSelection | null,
  col: number,
  row: number,
): boolean {
  if (!selection) return false;
  return (
    col >= selection.min.col &&
    col <= selection.max.col &&
    row >= selection.min.row &&
    row <= selection.max.row
  );
}

export function isCellActive(
  activeCell: CellPosition | null,
  col: number,
  row: number,
): boolean {
  if (!activeCell) return false;
  return activeCell.col === col && activeCell.row === row;
}

type UseSelectionOptions = {
  rowCount: number;
  colCount: number;
  stopEditing: () => void;
  onSelectionChange?: (selection: GridSelection | null) => void;
};

export function useSelection({
  rowCount,
  colCount,
  stopEditing,
  onSelectionChange,
}: UseSelectionOptions) {
  const [selectionState, setSelectionState] = useState<SelectionState>({
    activeCell: null,
    anchor: null,
  });

  const [isDragging, setIsDragging] = useState(false);

  const startDrag = useCallback(() => setIsDragging(true), []);
  const stopDrag = useCallback(() => setIsDragging(false), []);

  useEffect(
    function clampSelectionWhenDataSizeChanges() {
      setSelectionState((prev) => {
        if (!prev.activeCell) return prev;

        const maxRow = rowCount - 1;
        const maxCol = colCount - 1;

        if (maxRow < 0 || maxCol < 0) {
          stopEditing();
          return { activeCell: null, anchor: null };
        }

        const clampedActiveCell = {
          col: Math.min(prev.activeCell.col, maxCol),
          row: Math.min(prev.activeCell.row, maxRow),
        };

        const clampedAnchor = prev.anchor
          ? {
              col: Math.min(prev.anchor.col, maxCol),
              row: Math.min(prev.anchor.row, maxRow),
            }
          : null;

        const activeCellChanged =
          clampedActiveCell.col !== prev.activeCell.col ||
          clampedActiveCell.row !== prev.activeCell.row;
        const anchorChanged =
          clampedAnchor?.col !== prev.anchor?.col ||
          clampedAnchor?.row !== prev.anchor?.row;

        if (activeCellChanged || anchorChanged) {
          return {
            activeCell: clampedActiveCell,
            anchor: clampedAnchor,
          };
        }

        return prev;
      });
    },
    [rowCount, colCount, stopEditing],
  );

  // Compute selection from active cell and anchor
  const selection = useMemo((): GridSelection | null => {
    if (!selectionState.activeCell) return null;

    const anchor = selectionState.anchor ?? selectionState.activeCell;
    return {
      min: {
        col: Math.min(selectionState.activeCell.col, anchor.col),
        row: Math.min(selectionState.activeCell.row, anchor.row),
      },
      max: {
        col: Math.max(selectionState.activeCell.col, anchor.col),
        row: Math.max(selectionState.activeCell.row, anchor.row),
      },
    };
  }, [selectionState.activeCell, selectionState.anchor]);

  const setActiveCell = useCallback(
    (cell: CellPosition, extend = false) => {
      setSelectionState((prev) => {
        const isSameCell =
          prev.activeCell?.col === cell.col &&
          prev.activeCell?.row === cell.row;

        if (!isSameCell) {
          stopEditing();
        }

        return {
          activeCell: cell,
          anchor: extend ? (prev.anchor ?? prev.activeCell) : null,
        };
      });

      // Compute selection for callback
      const newSelection: GridSelection =
        extend && selectionState.anchor
          ? {
              min: {
                col: Math.min(cell.col, selectionState.anchor.col),
                row: Math.min(cell.row, selectionState.anchor.row),
              },
              max: {
                col: Math.max(cell.col, selectionState.anchor.col),
                row: Math.max(cell.row, selectionState.anchor.row),
              },
            }
          : { min: cell, max: cell };
      onSelectionChange?.(newSelection);
    },
    [onSelectionChange, selectionState.anchor, stopEditing],
  );

  const clearSelection = useCallback(() => {
    setSelectionState({ activeCell: null, anchor: null });
    stopEditing();
    onSelectionChange?.(null);
  }, [onSelectionChange, stopEditing]);

  const selectCells = useCallback(
    (options?: { colIndex?: number; rowIndex?: number; extend?: boolean }) => {
      const { colIndex, rowIndex, extend = false } = options ?? {};

      // Determine the target range based on provided indices
      const targetMin: CellPosition = {
        col: colIndex ?? 0,
        row: rowIndex ?? 0,
      };
      const targetMax: CellPosition = {
        col: colIndex ?? colCount - 1,
        row: rowIndex ?? rowCount - 1,
      };

      // Early return if grid is empty
      if (rowCount === 0 || colCount === 0) return;

      let newSelection: GridSelection;
      let newAnchor: CellPosition;
      let newActiveCell: CellPosition;

      if (extend && selectionState.anchor) {
        // Extend from existing anchor
        newAnchor = selectionState.anchor;
        newActiveCell = targetMax;
        newSelection = {
          min: {
            col: Math.min(targetMin.col, selectionState.anchor.col),
            row: Math.min(targetMin.row, selectionState.anchor.row),
          },
          max: {
            col: Math.max(targetMax.col, selectionState.anchor.col),
            row: Math.max(targetMax.row, selectionState.anchor.row),
          },
        };
      } else {
        // Reset selection to target range
        newAnchor = targetMin;
        newActiveCell = targetMax;
        newSelection = { min: targetMin, max: targetMax };
      }

      setSelectionState({
        activeCell: newActiveCell,
        anchor: newAnchor,
      });
      stopEditing();
      onSelectionChange?.(newSelection);
    },
    [rowCount, colCount, onSelectionChange, selectionState.anchor, stopEditing],
  );

  const moveActiveCell = useCallback(
    (direction: "up" | "down" | "left" | "right", extend = false) => {
      setSelectionState((prev) => {
        if (!prev.activeCell) return prev;

        let newCol = prev.activeCell.col;
        let newRow = prev.activeCell.row;

        switch (direction) {
          case "up":
            newRow = Math.max(0, newRow - 1);
            break;
          case "down":
            newRow = Math.min(rowCount - 1, newRow + 1);
            break;
          case "left":
            newCol = Math.max(0, newCol - 1);
            break;
          case "right":
            newCol = Math.min(colCount - 1, newCol + 1);
            break;
        }

        const newCell = { col: newCol, row: newRow };
        const newAnchor = extend ? (prev.anchor ?? prev.activeCell) : null;

        const newSelection: GridSelection = newAnchor
          ? {
              min: {
                col: Math.min(newCell.col, newAnchor.col),
                row: Math.min(newCell.row, newAnchor.row),
              },
              max: {
                col: Math.max(newCell.col, newAnchor.col),
                row: Math.max(newCell.row, newAnchor.row),
              },
            }
          : { min: newCell, max: newCell };

        onSelectionChange?.(newSelection);

        return {
          activeCell: newCell,
          anchor: newAnchor,
        };
      });
      stopEditing();
    },
    [rowCount, colCount, onSelectionChange, stopEditing],
  );

  const moveToRowStart = useCallback(
    (extend = false) => {
      setSelectionState((prev) => {
        if (!prev.activeCell) return prev;

        const newCell = { col: 0, row: prev.activeCell.row };
        const newAnchor = extend ? (prev.anchor ?? prev.activeCell) : null;

        const newSelection: GridSelection = newAnchor
          ? {
              min: {
                col: Math.min(newCell.col, newAnchor.col),
                row: Math.min(newCell.row, newAnchor.row),
              },
              max: {
                col: Math.max(newCell.col, newAnchor.col),
                row: Math.max(newCell.row, newAnchor.row),
              },
            }
          : { min: newCell, max: newCell };

        onSelectionChange?.(newSelection);

        return {
          activeCell: newCell,
          anchor: newAnchor,
        };
      });
      stopEditing();
    },
    [onSelectionChange, stopEditing],
  );

  const moveToRowEnd = useCallback(
    (extend = false) => {
      setSelectionState((prev) => {
        if (!prev.activeCell) return prev;

        const newCell = { col: colCount - 1, row: prev.activeCell.row };
        const newAnchor = extend ? (prev.anchor ?? prev.activeCell) : null;

        const newSelection: GridSelection = newAnchor
          ? {
              min: {
                col: Math.min(newCell.col, newAnchor.col),
                row: Math.min(newCell.row, newAnchor.row),
              },
              max: {
                col: Math.max(newCell.col, newAnchor.col),
                row: Math.max(newCell.row, newAnchor.row),
              },
            }
          : { min: newCell, max: newCell };

        onSelectionChange?.(newSelection);

        return {
          activeCell: newCell,
          anchor: newAnchor,
        };
      });
      stopEditing();
    },
    [colCount, onSelectionChange, stopEditing],
  );

  const moveToGridStart = useCallback(
    (extend = false) => {
      setSelectionState((prev) => {
        if (!prev.activeCell && !extend) {
          // If no active cell, just set to first cell
          const newCell = { col: 0, row: 0 };
          onSelectionChange?.({ min: newCell, max: newCell });
          return { activeCell: newCell, anchor: null };
        }

        const newCell = { col: 0, row: 0 };
        const newAnchor = extend ? (prev.anchor ?? prev.activeCell) : null;

        const newSelection: GridSelection = newAnchor
          ? {
              min: {
                col: Math.min(newCell.col, newAnchor.col),
                row: Math.min(newCell.row, newAnchor.row),
              },
              max: {
                col: Math.max(newCell.col, newAnchor.col),
                row: Math.max(newCell.row, newAnchor.row),
              },
            }
          : { min: newCell, max: newCell };

        onSelectionChange?.(newSelection);

        return {
          activeCell: newCell,
          anchor: newAnchor,
        };
      });
      stopEditing();
    },
    [onSelectionChange, stopEditing],
  );

  const moveToGridEnd = useCallback(
    (extend = false) => {
      setSelectionState((prev) => {
        if (!prev.activeCell && !extend) {
          const newCell = { col: colCount - 1, row: rowCount - 1 };
          onSelectionChange?.({ min: newCell, max: newCell });
          return { activeCell: newCell, anchor: null };
        }

        const newCell = { col: colCount - 1, row: rowCount - 1 };
        const newAnchor = extend ? (prev.anchor ?? prev.activeCell) : null;

        const newSelection: GridSelection = newAnchor
          ? {
              min: {
                col: Math.min(newCell.col, newAnchor.col),
                row: Math.min(newCell.row, newAnchor.row),
              },
              max: {
                col: Math.max(newCell.col, newAnchor.col),
                row: Math.max(newCell.row, newAnchor.row),
              },
            }
          : { min: newCell, max: newCell };

        onSelectionChange?.(newSelection);

        return {
          activeCell: newCell,
          anchor: newAnchor,
        };
      });
      stopEditing();
    },
    [rowCount, colCount, onSelectionChange, stopEditing],
  );

  const moveByPage = useCallback(
    (direction: "up" | "down", pageSize: number, extend = false) => {
      setSelectionState((prev) => {
        if (!prev.activeCell) return prev;

        const delta = direction === "up" ? -pageSize : pageSize;
        const newRow = Math.max(
          0,
          Math.min(rowCount - 1, prev.activeCell.row + delta),
        );
        const newCell = { col: prev.activeCell.col, row: newRow };
        const newAnchor = extend ? (prev.anchor ?? prev.activeCell) : null;

        const newSelection: GridSelection = newAnchor
          ? {
              min: {
                col: Math.min(newCell.col, newAnchor.col),
                row: Math.min(newCell.row, newAnchor.row),
              },
              max: {
                col: Math.max(newCell.col, newAnchor.col),
                row: Math.max(newCell.row, newAnchor.row),
              },
            }
          : { min: newCell, max: newCell };

        onSelectionChange?.(newSelection);

        return {
          activeCell: newCell,
          anchor: newAnchor,
        };
      });
      stopEditing();
    },
    [rowCount, onSelectionChange, stopEditing],
  );

  return {
    activeCell: selectionState.activeCell,
    selection,
    setActiveCell,
    clearSelection,
    moveActiveCell,
    moveToRowStart,
    moveToRowEnd,
    moveToGridStart,
    moveToGridEnd,
    moveByPage,
    selectCells,
    isDragging,
    startDrag,
    stopDrag,
  };
}
