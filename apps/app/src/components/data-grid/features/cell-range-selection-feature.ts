import {
  makeStateUpdater,
  memo,
  type Cell,
  type Column,
  type OnChangeFn,
  type Row,
  type RowData,
  type Table,
  type TableFeature,
  type Updater,
} from "@tanstack/react-table";
import type { CellPosition, GridSelection } from "../types";
import { isLazyRowModel } from "../models/lazy-core-row-model";

export type CellRangeSelectionInternalState = {
  range: GridSelection | null;
};

export type SelectionEdge = {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
};

declare module "@tanstack/react-table" {
  interface TableState {
    cellRangeSelection: CellRangeSelectionInternalState;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableOptionsResolved<TData extends RowData> {
    onCellRangeSelectionChange?: OnChangeFn<CellRangeSelectionInternalState>;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Table<TData extends RowData> {
    setCellRangeSelection: (
      updater: Updater<CellRangeSelectionInternalState>,
    ) => void;
    getSelection: () => GridSelection | null;
    selectRange: (range: GridSelection) => void;
    clearSelection: () => void;
    isSelectionFullRows: () => boolean;
    isCellSelected: (col: number, row: number) => boolean;
    isSingleCellSelection: () => boolean;
    updateSelection: (options: {
      col?: number;
      row?: number;
      extend?: boolean;
    }) => { range: GridSelection; movingCorner: CellPosition } | null;
    /**
     * Memoized lookup from row id → visual (displayed) row position.
     * Rebuilt only when the sorted/filtered row model changes.
     */
    getVisualIndexLookup: () => Map<string, number>;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Cell<TData extends RowData, TValue> {
    isSelected: () => boolean;
    getSelectionEdge: () => SelectionEdge | undefined;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Row<TData extends RowData> {
    isFullySelected: () => boolean;
    /**
     * Position of this row in the currently displayed row model
     * (after sorting/filtering). Distinct from `row.index`, which is
     * the row's position in the original data array.
     */
    getVisualIndex: () => number;
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

    table.getSelection = memo(
      () => [
        table.getState().cellRangeSelection.range,
        table.getVisibleLeafColumns().length,
        table.getRowModel().rows.length,
      ],
      (range, colCount, rowCount) => {
        if (!range) return null;
        if (colCount === 0 || rowCount === 0) return null;
        // Skip allocation when the range is already within bounds.
        if (
          range.max.col < colCount &&
          range.max.row < rowCount &&
          range.min.col < colCount &&
          range.min.row < rowCount
        ) {
          return range;
        }
        return clampRange(range, colCount, rowCount);
      },
      { key: "CellRangeSelectionFeature.getSelection" },
    );

    table.selectRange = (range) => {
      table.setCellRangeSelection({ range });
    };

    table.clearSelection = () => {
      const prev = table.getState().cellRangeSelection.range;
      if (!prev) return;
      table.setCellRangeSelection(EMPTY);
    };

    table.isSelectionFullRows = () =>
      isFullRowSelected(
        table.getSelection(),
        table.getVisibleLeafColumns().length,
      );

    table.isCellSelected = (col, row) =>
      isCellSelected(table.getSelection(), col, row);

    table.isSingleCellSelection = () =>
      isSingleCellSelection(table.getSelection());

    table.getVisualIndexLookup = memo(
      () => [table.getRowModel().rows],
      (rows) => {
        const map = new Map<string, number>();
        for (let i = 0; i < rows.length; i++) {
          map.set(rows[i].id, i);
        }
        return map;
      },
      { key: "CellRangeSelectionFeature.getVisualIndexLookup" },
    );

    table.updateSelection = ({ col, row, extend = false }) => {
      const rowCount = table.getRowModel().rows.length;
      const colCount = table.getVisibleLeafColumns().length;
      if (rowCount === 0 || colCount === 0) return null;

      const target = computeTargetSelection(col, row, colCount, rowCount);
      const current = table.getSelection();

      if (extend && current) {
        const { combined, movingCorner } = computeExtendedRange(
          current,
          target,
        );
        table.selectRange(combined);
        return { range: combined, movingCorner };
      }

      table.selectRange(target);
      return { range: target, movingCorner: target.min };
    };
  },

  createRow: <TData extends RowData>(
    row: Row<TData>,
    table: Table<TData>,
  ): void => {
    row.getVisualIndex = () => {
      // In lazy mode derive the visual (display) position from the sort order
      // by data index, so we never iterate/materialize the full row set.
      if (isLazyRowModel(table)) {
        const { visualByDataIndex } = table.getLazyRowOrder();
        return visualByDataIndex ? visualByDataIndex[row.index] : row.index;
      }
      return table.getVisualIndexLookup().get(row.id) ?? row.index;
    };

    row.isFullySelected = () =>
      table.isSelectionFullRows() &&
      isCellSelected(table.getSelection(), 0, row.getVisualIndex());
  },

  createCell: <TData extends RowData, TValue>(
    cell: Cell<TData, TValue>,
    _column: Column<TData, TValue>,
    _row: Row<TData>,
    table: Table<TData>,
  ): void => {
    cell.isSelected = () =>
      isCellSelected(
        table.getSelection(),
        cell.column.getIndex(),
        cell.row.getVisualIndex(),
      );

    cell.getSelectionEdge = () => {
      const selection = table.getSelection();
      if (!selection || !cell.isSelected()) return undefined;
      const colIndex = cell.column.getIndex();
      const rowIndex = cell.row.getVisualIndex();
      return {
        top: rowIndex === selection.min.row,
        bottom: rowIndex === selection.max.row,
        left: colIndex === selection.min.col,
        right: colIndex === selection.max.col,
      };
    };
  },
};

function clampRange(
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

function isSingleCellSelection(selection: GridSelection | null): boolean {
  if (!selection) return false;
  return (
    selection.min.col === selection.max.col &&
    selection.min.row === selection.max.row
  );
}

function isFullRowSelected(
  selection: GridSelection | null,
  colCount: number,
): boolean {
  if (!selection) return false;
  return selection.min.col === 0 && selection.max.col === colCount - 1;
}

function isCellSelected(
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

// Pure helpers consumed by DataGrid to coordinate active cell + range.

function computeTargetSelection(
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

function computeExtendedRange(
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
