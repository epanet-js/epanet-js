import {
  makeStateUpdater,
  type OnChangeFn,
  type RowData,
  type Table,
  type TableFeature,
  type Updater,
} from "@tanstack/react-table";
import type { CellPosition, GridSelection } from "../types";

export type CellRangeSelectionInternalState = {
  range: GridSelection | null;
};

declare module "@tanstack/react-table" {
  interface TableState {
    cellRangeSelection: CellRangeSelectionInternalState;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableOptionsResolved<TData extends RowData> {
    onCellRangeSelectionChange?: OnChangeFn<CellRangeSelectionInternalState>;
    onSelectionChange?: (selection: GridSelection | null) => void;
    rowCount?: number;
    colCount?: number;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Table<TData extends RowData> {
    setCellRangeSelection: (
      updater: Updater<CellRangeSelectionInternalState>,
    ) => void;
    getSelection: () => GridSelection | null;
    selectRange: (range: GridSelection) => void;
    clearSelection: () => void;
  }
}

const EMPTY: CellRangeSelectionInternalState = { range: null };

export const CellRangeSelectionFeature: TableFeature = {
  getInitialState: (
    state,
  ): Partial<{ cellRangeSelection: CellRangeSelectionInternalState }> => ({
    cellRangeSelection: EMPTY,
    ...state,
  }),

  getDefaultOptions: <TData extends RowData>(table: Table<TData>) => ({
    onCellRangeSelectionChange: makeStateUpdater("cellRangeSelection", table),
  }),

  createTable: <TData extends RowData>(table: Table<TData>): void => {
    table.setCellRangeSelection = (updater) => {
      table.options.onCellRangeSelectionChange?.(updater);
    };

    table.getSelection = () => table.getState().cellRangeSelection.range;

    table.selectRange = (range) => {
      table.setCellRangeSelection({ range });
    };

    table.clearSelection = () => {
      const prev = table.getState().cellRangeSelection.range;
      if (!prev) return;
      table.setCellRangeSelection(EMPTY);
    };
  },
};

export function isRangeEqual(
  a: GridSelection | null,
  b: GridSelection | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.min.col === b.min.col &&
    a.min.row === b.min.row &&
    a.max.col === b.max.col &&
    a.max.row === b.max.row
  );
}

export function clampRange(
  range: GridSelection | null,
  colCount: number,
  rowCount: number,
): GridSelection | null {
  if (!range) return null;
  return {
    min: {
      col: Math.min(range.min.col, colCount - 1),
      row: Math.min(range.min.row, rowCount - 1),
    },
    max: {
      col: Math.min(range.max.col, colCount - 1),
      row: Math.min(range.max.row, rowCount - 1),
    },
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

// Pure helpers consumed by DataGridWithFeatures to coordinate active cell + range.

export function computeTargetSelection(
  colIndex: number | undefined,
  rowIndex: number | undefined,
  colCount: number,
  rowCount: number,
): GridSelection {
  return {
    min: { col: colIndex ?? 0, row: rowIndex ?? 0 },
    max: {
      col: colIndex ?? colCount - 1,
      row: rowIndex ?? rowCount - 1,
    },
  };
}

export function computeExtendedRange(
  current: GridSelection,
  target: GridSelection,
): { combined: GridSelection; movingCorner: CellPosition } {
  const combined: GridSelection = {
    min: {
      col: Math.min(current.min.col, target.min.col),
      row: Math.min(current.min.row, target.min.row),
    },
    max: {
      col: Math.max(current.max.col, target.max.col),
      row: Math.max(current.max.row, target.max.row),
    },
  };

  const extendingDown = target.max.row >= current.max.row;
  const extendingRight = target.max.col >= current.max.col;

  return {
    combined,
    movingCorner: {
      col: extendingRight ? combined.max.col : combined.min.col,
      row: extendingDown ? combined.max.row : combined.min.row,
    },
  };
}
