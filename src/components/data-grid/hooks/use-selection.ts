import { useCallback, useEffect, useMemo, useState } from "react";
import { CellPosition, SelectionState, GridSelection } from "../types";

type UseSelectionOptions = {
  rowCount: number;
  colCount: number;
  onSelectionChange?: (selection: GridSelection | null) => void;
};

export function useSelection({
  rowCount,
  colCount,
  onSelectionChange,
}: UseSelectionOptions) {
  const [state, setState] = useState<SelectionState>({
    activeCell: null,
    anchor: null,
    editMode: false,
  });

  const [isDragging, setIsDragging] = useState(false);

  const startDrag = useCallback(() => setIsDragging(true), []);
  const stopDrag = useCallback(() => setIsDragging(false), []);

  useEffect(
    function clampSelectionWhenDataSizeChanges() {
      setState((prev) => {
        if (!prev.activeCell) return prev;

        const maxRow = rowCount - 1;
        const maxCol = colCount - 1;

        if (maxRow < 0 || maxCol < 0) {
          return { activeCell: null, anchor: null, editMode: false };
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
            editMode: prev.editMode,
          };
        }

        return prev;
      });
    },
    [rowCount, colCount],
  );

  // Compute selection from active cell and anchor
  const selection = useMemo((): GridSelection | null => {
    if (!state.activeCell) return null;

    const anchor = state.anchor ?? state.activeCell;
    return {
      min: {
        col: Math.min(state.activeCell.col, anchor.col),
        row: Math.min(state.activeCell.row, anchor.row),
      },
      max: {
        col: Math.max(state.activeCell.col, anchor.col),
        row: Math.max(state.activeCell.row, anchor.row),
      },
    };
  }, [state.activeCell, state.anchor]);

  const setActiveCell = useCallback(
    (cell: CellPosition, extend = false) => {
      setState((prev) => {
        const isSameCell =
          prev.activeCell?.col === cell.col &&
          prev.activeCell?.row === cell.row;

        const newState: SelectionState = {
          activeCell: cell,
          anchor: extend ? (prev.anchor ?? prev.activeCell) : null,
          editMode: isSameCell ? prev.editMode : false,
        };
        return newState;
      });

      // Compute selection for callback
      const newSelection: GridSelection =
        extend && state.anchor
          ? {
              min: {
                col: Math.min(cell.col, state.anchor.col),
                row: Math.min(cell.row, state.anchor.row),
              },
              max: {
                col: Math.max(cell.col, state.anchor.col),
                row: Math.max(cell.row, state.anchor.row),
              },
            }
          : { min: cell, max: cell };
      onSelectionChange?.(newSelection);
    },
    [onSelectionChange, state.anchor],
  );

  const clearSelection = useCallback(() => {
    setState({ activeCell: null, anchor: null, editMode: false });
    onSelectionChange?.(null);
  }, [onSelectionChange]);

  const startEditing = useCallback((mode: "quick" | "full" = "full") => {
    setState((prev) => ({ ...prev, editMode: mode }));
  }, []);

  const stopEditing = useCallback(() => {
    setState((prev) => ({ ...prev, editMode: false }));
  }, []);

  const moveActiveCell = useCallback(
    (direction: "up" | "down" | "left" | "right", extend = false) => {
      setState((prev) => {
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
          editMode: false,
        };
      });
    },
    [rowCount, colCount, onSelectionChange],
  );

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

      if (extend && state.anchor) {
        // Extend from existing anchor
        newAnchor = state.anchor;
        newActiveCell = targetMax;
        newSelection = {
          min: {
            col: Math.min(targetMin.col, state.anchor.col),
            row: Math.min(targetMin.row, state.anchor.row),
          },
          max: {
            col: Math.max(targetMax.col, state.anchor.col),
            row: Math.max(targetMax.row, state.anchor.row),
          },
        };
      } else {
        // Reset selection to target range
        newAnchor = targetMin;
        newActiveCell = targetMax;
        newSelection = { min: targetMin, max: targetMax };
      }

      setState({
        activeCell: newActiveCell,
        anchor: newAnchor,
        editMode: false,
      });
      onSelectionChange?.(newSelection);
    },
    [rowCount, colCount, onSelectionChange, state.anchor],
  );

  const moveToRowStart = useCallback(
    (extend = false) => {
      setState((prev) => {
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
          editMode: false,
        };
      });
    },
    [onSelectionChange],
  );

  const moveToRowEnd = useCallback(
    (extend = false) => {
      setState((prev) => {
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
          editMode: false,
        };
      });
    },
    [colCount, onSelectionChange],
  );

  const moveToGridStart = useCallback(
    (extend = false) => {
      setState((prev) => {
        if (!prev.activeCell && !extend) {
          // If no active cell, just set to first cell
          const newCell = { col: 0, row: 0 };
          onSelectionChange?.({ min: newCell, max: newCell });
          return { activeCell: newCell, anchor: null, editMode: false };
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
          editMode: false,
        };
      });
    },
    [onSelectionChange],
  );

  const moveToGridEnd = useCallback(
    (extend = false) => {
      setState((prev) => {
        if (!prev.activeCell && !extend) {
          const newCell = { col: colCount - 1, row: rowCount - 1 };
          onSelectionChange?.({ min: newCell, max: newCell });
          return { activeCell: newCell, anchor: null, editMode: false };
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
          editMode: false,
        };
      });
    },
    [rowCount, colCount, onSelectionChange],
  );

  const moveByPage = useCallback(
    (direction: "up" | "down", pageSize: number, extend = false) => {
      setState((prev) => {
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
          editMode: false,
        };
      });
    },
    [rowCount, onSelectionChange],
  );

  const isFullRowSelected = useMemo(() => {
    if (!selection) return false;
    return selection.min.col === 0 && selection.max.col === colCount - 1;
  }, [selection, colCount]);

  const isCellSelected = useCallback(
    (col: number, row: number) => {
      if (!selection) return false;
      return (
        col >= selection.min.col &&
        col <= selection.max.col &&
        row >= selection.min.row &&
        row <= selection.max.row
      );
    },
    [selection],
  );

  const isCellActive = useCallback(
    (col: number, row: number) => {
      if (!state.activeCell) return false;
      return state.activeCell.col === col && state.activeCell.row === row;
    },
    [state.activeCell],
  );

  return {
    activeCell: state.activeCell,
    selection,
    editMode: state.editMode,
    isFullRowSelected,
    setActiveCell,
    clearSelection,
    startEditing,
    stopEditing,
    moveActiveCell,
    moveToRowStart,
    moveToRowEnd,
    moveToGridStart,
    moveToGridEnd,
    moveByPage,
    selectCells,
    isCellSelected,
    isCellActive,
    isDragging,
    startDrag,
    stopDrag,
  };
}
