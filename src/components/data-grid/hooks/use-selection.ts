import { useCallback, useEffect, useMemo, useState } from "react";
import { CellPosition, GridSelection } from "../types";

type ActiveSelection = {
  activeCell: CellPosition;
  anchor: CellPosition;
};

type NoSelection = {
  activeCell: null;
  anchor: null;
};

type SelectionState = ActiveSelection | NoSelection;

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

  useEffect(
    function clampSelectionWhenDataSizeChanges() {
      setSelectionState((prev) => {
        if (!prev.activeCell) return prev;

        if (rowCount === 0 || colCount === 0) {
          stopEditing();
          return { activeCell: null, anchor: null };
        }

        const clampedState: SelectionState = {
          activeCell: clampPosition(prev.activeCell, colCount, rowCount),
          anchor: clampPosition(prev.anchor, colCount, rowCount),
        };

        return isSelectionStateEqual(prev, clampedState) ? prev : clampedState;
      });
    },
    [rowCount, colCount, stopEditing],
  );

  const selection = useMemo((): GridSelection | null => {
    if (!selectionState.activeCell) return null;
    return computeSelectionBounds(
      selectionState.activeCell,
      selectionState.anchor,
    );
  }, [selectionState]);

  const clearSelection = useCallback(() => {
    setSelectionState({ activeCell: null, anchor: null });
    stopEditing();
    onSelectionChange?.(null);
  }, [onSelectionChange, stopEditing]);

  const selectCells = useCallback(
    (options?: { colIndex?: number; rowIndex?: number; extend?: boolean }) => {
      const { colIndex, rowIndex, extend = false } = options ?? {};

      if (rowCount === 0 || colCount === 0) return;

      const target = computeTargetSelection(
        colIndex,
        rowIndex,
        colCount,
        rowCount,
      );

      const newSelectionState =
        extend && selectionState.activeCell
          ? extendSelection(selectionState, target)
          : {
              anchor: target.min,
              activeCell: target.max,
            };

      const selectionChanged = !isSelectionStateEqual(
        selectionState,
        newSelectionState,
      );

      const selectionRange = computeSelectionBounds(
        newSelectionState.activeCell,
        newSelectionState.anchor,
      );

      if (selectionChanged || !isSingleCellSelection(selectionRange)) {
        stopEditing();
      }

      setSelectionState(newSelectionState);
      onSelectionChange?.(selectionRange);
    },
    [rowCount, colCount, onSelectionChange, selectionState, stopEditing],
  );

  return {
    activeCell: selectionState.activeCell,
    selection,
    clearSelection,
    selectCells,
  };
}

export function isSingleCellSelection(
  selection: GridSelection | null,
): boolean {
  if (!selection) return false;
  return (
    selection.min.col === selection.max.col &&
    selection.min.row === selection.max.row
  );
}

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

function computeTargetSelection(
  colIndex: number | undefined,
  rowIndex: number | undefined,
  colCount: number,
  rowCount: number,
): GridSelection {
  return {
    min: {
      col: colIndex ?? 0,
      row: rowIndex ?? 0,
    },
    max: {
      col: colIndex ?? colCount - 1,
      row: rowIndex ?? rowCount - 1,
    },
  };
}

function isSelectionStateEqual(a: SelectionState, b: SelectionState): boolean {
  // Both null or both set (discriminated union)
  if (!a.activeCell && !b.activeCell) return true;
  if (!a.activeCell || !b.activeCell) return false;

  return (
    a.activeCell.col === b.activeCell.col &&
    a.activeCell.row === b.activeCell.row &&
    a.anchor.col === b.anchor.col &&
    a.anchor.row === b.anchor.row
  );
}

function computeSelectionBounds(
  activeCell: CellPosition,
  anchor?: CellPosition | null,
): GridSelection {
  const effectiveAnchor = anchor ?? activeCell;
  return {
    min: {
      col: Math.min(activeCell.col, effectiveAnchor.col),
      row: Math.min(activeCell.row, effectiveAnchor.row),
    },
    max: {
      col: Math.max(activeCell.col, effectiveAnchor.col),
      row: Math.max(activeCell.row, effectiveAnchor.row),
    },
  };
}

function clampPosition(
  position: CellPosition,
  colCount: number,
  rowCount: number,
): CellPosition {
  return {
    col: Math.min(position.col, colCount - 1),
    row: Math.min(position.row, rowCount - 1),
  };
}

function extendSelection(
  activeSelection: ActiveSelection,
  target: GridSelection,
): ActiveSelection {
  const original = computeSelectionBounds(
    activeSelection.activeCell,
    activeSelection.anchor,
  );

  const combined: GridSelection = {
    min: {
      col: Math.min(original.min.col, target.min.col),
      row: Math.min(original.min.row, target.min.row),
    },
    max: {
      col: Math.max(original.max.col, target.max.col),
      row: Math.max(original.max.row, target.max.row),
    },
  };

  // Determine extension direction based on target vs current selection
  const extendingDown = target.max.row >= original.max.row;
  const extendingRight = target.max.col >= original.max.col;

  // Place activeCell in the extending direction, anchor at opposite corner
  return {
    activeCell: {
      col: extendingRight ? combined.max.col : combined.min.col,
      row: extendingDown ? combined.max.row : combined.min.row,
    },
    anchor: {
      col: extendingRight ? combined.min.col : combined.max.col,
      row: extendingDown ? combined.min.row : combined.max.row,
    },
  };
}
