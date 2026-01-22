import { useCallback, useMemo, useState } from "react";
import { CellPosition, SelectionState, SpreadsheetSelection } from "./types";

type UseSelectionOptions = {
  rowCount: number;
  colCount: number;
  onSelectionChange?: (selection: SpreadsheetSelection | null) => void;
};

export function useSelection({
  rowCount,
  colCount,
  onSelectionChange,
}: UseSelectionOptions) {
  const [state, setState] = useState<SelectionState>({
    activeCell: null,
    anchor: null,
    isEditing: false,
  });

  // Compute selection from active cell and anchor
  const selection = useMemo((): SpreadsheetSelection | null => {
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
        const newState: SelectionState = {
          activeCell: cell,
          anchor: extend ? (prev.anchor ?? prev.activeCell) : null,
          isEditing: false,
        };
        return newState;
      });

      // Compute selection for callback
      const newSelection: SpreadsheetSelection =
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

  const setSelection = useCallback(
    (newSelection: SpreadsheetSelection | null) => {
      if (newSelection === null) {
        setState({ activeCell: null, anchor: null, isEditing: false });
        onSelectionChange?.(null);
      } else {
        setState({
          activeCell: newSelection.max,
          anchor: newSelection.min,
          isEditing: false,
        });
        onSelectionChange?.(newSelection);
      }
    },
    [onSelectionChange],
  );

  const clearSelection = useCallback(() => {
    setState({ activeCell: null, anchor: null, isEditing: false });
    onSelectionChange?.(null);
  }, [onSelectionChange]);

  const startEditing = useCallback(() => {
    setState((prev) => ({ ...prev, isEditing: true }));
  }, []);

  const stopEditing = useCallback(() => {
    setState((prev) => ({ ...prev, isEditing: false }));
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

        const newSelection: SpreadsheetSelection = newAnchor
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
          isEditing: false,
        };
      });
    },
    [rowCount, colCount, onSelectionChange],
  );

  const selectRow = useCallback(
    (rowIndex: number, extend = false) => {
      const newSelection: SpreadsheetSelection =
        extend && state.anchor
          ? {
              min: {
                col: 0,
                row: Math.min(rowIndex, state.anchor.row),
              },
              max: {
                col: colCount - 1,
                row: Math.max(rowIndex, state.anchor.row),
              },
            }
          : {
              min: { col: 0, row: rowIndex },
              max: { col: colCount - 1, row: rowIndex },
            };

      setState({
        activeCell: { col: 0, row: rowIndex },
        anchor: extend
          ? (state.anchor ?? { col: 0, row: state.activeCell?.row ?? rowIndex })
          : { col: 0, row: rowIndex },
        isEditing: false,
      });
      onSelectionChange?.(newSelection);
    },
    [colCount, onSelectionChange, state.anchor, state.activeCell],
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
    isEditing: state.isEditing,
    isFullRowSelected,
    setActiveCell,
    setSelection,
    clearSelection,
    startEditing,
    stopEditing,
    moveActiveCell,
    selectRow,
    isCellSelected,
    isCellActive,
  };
}
