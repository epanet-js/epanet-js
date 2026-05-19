import {
  makeStateUpdater,
  type Column,
  type OnChangeFn,
  type RowData,
  type Table,
  type TableFeature,
  type Updater,
} from "@tanstack/react-table";

export type CellPosition = { col: number; row: number };

export type EditMode = false | "quick" | "full";

export type CellEditingInternalState = {
  activeCell: CellPosition | null;
  editMode: EditMode;
};

declare module "@tanstack/react-table" {
  interface TableState {
    cellEditing: CellEditingInternalState;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableOptionsResolved<TData extends RowData> {
    onCellEditingChange?: OnChangeFn<CellEditingInternalState>;
    readOnly?: boolean;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    isReadOnly?: boolean | ((rowIndex: number) => boolean);
    deleteValue?: unknown;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Table<TData extends RowData> {
    setCellEditing: (updater: Updater<CellEditingInternalState>) => void;
    getActiveCell: () => CellPosition | null;
    setActiveCell: (position: CellPosition | null) => void;
    getEditMode: () => EditMode;
    startEditing: (mode?: "quick" | "full") => void;
    stopEditing: () => void;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Column<TData extends RowData, TValue> {
    isReadOnly: (rowIndex: number) => boolean;
    getDeleteValue: () => unknown;
  }
}

const EMPTY: CellEditingInternalState = { activeCell: null, editMode: false };

export const CellEditingFeature: TableFeature = {
  getInitialState: (
    state,
  ): Partial<{ cellEditing: CellEditingInternalState }> => ({
    cellEditing: EMPTY,
    ...state,
  }),

  getDefaultOptions: <TData extends RowData>(table: Table<TData>) => ({
    onCellEditingChange: makeStateUpdater("cellEditing", table),
  }),

  createTable: <TData extends RowData>(table: Table<TData>): void => {
    table.setCellEditing = (updater) => {
      table.options.onCellEditingChange?.(updater);
    };

    table.getActiveCell = () => table.getState().cellEditing.activeCell;

    table.setActiveCell = (position) => {
      table.setCellEditing((prev) => ({ ...prev, activeCell: position }));
    };

    table.getEditMode = () => table.getState().cellEditing.editMode;

    table.startEditing = (mode = "full") => {
      table.setCellEditing((prev) => ({ ...prev, editMode: mode }));
    };

    table.stopEditing = () => {
      table.setCellEditing((prev) => {
        if (!prev.editMode) return prev;
        return { ...prev, editMode: false };
      });
    };
  },

  createColumn: <TData extends RowData>(
    column: Column<TData, unknown>,
    table: Table<TData>,
  ): void => {
    column.isReadOnly = (rowIndex: number) => {
      if (table.options.readOnly) return true;
      const flag = column.columnDef.meta?.isReadOnly;
      if (typeof flag === "function") return flag(rowIndex);
      return !!flag;
    };

    column.getDeleteValue = () => column.columnDef.meta?.deleteValue;
  },
};

export function isActiveCellEqual(
  a: CellPosition | null,
  b: CellPosition | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.col === b.col && a.row === b.row;
}

export function clampActiveCell(
  position: CellPosition | null,
  colCount: number,
  rowCount: number,
): CellPosition | null {
  if (!position) return null;
  return {
    col: Math.min(position.col, colCount - 1),
    row: Math.min(position.row, rowCount - 1),
  };
}

export function isCellActive(
  activeCell: CellPosition | null,
  col: number,
  row: number,
): boolean {
  if (!activeCell) return false;
  return activeCell.col === col && activeCell.row === row;
}
