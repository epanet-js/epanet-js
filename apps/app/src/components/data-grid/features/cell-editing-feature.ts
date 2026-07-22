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
import { defaultPatchRow, type PatchRowFn } from "../utils/patch-row";
import { recordGridUpdate } from "../update-loop-probe";

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
    onDelete?: (rowsToDelete: TData[]) => void;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    isReadOnly?: boolean | ((rowIndex: number) => boolean);
    deleteValue?: TValue;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Table<TData extends RowData> {
    setCellEditing: (updater: Updater<CellEditingInternalState>) => void;
    getActiveCell: () => CellPosition | null;
    setActiveCell: (position: CellPosition | null) => void;
    getEditMode: () => EditMode;
    startEditing: (mode?: "quick" | "full") => void;
    stopEditing: () => void;
    deleteSelection: () => void;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Column<TData extends RowData, TValue> {
    isReadOnly: (rowIndex: number) => boolean;
    getDeleteValue: () => unknown;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Cell<TData extends RowData, TValue> {
    isActive: () => boolean;
    isInteractive: () => boolean;
    getEditMode: () => EditMode;
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

    table.getActiveCell = memo(
      () => [
        table.getState().cellEditing.activeCell,
        table.getVisibleLeafColumns().length,
        table.getRowModel().rows.length,
      ],
      (activeCell, colCount, rowCount) => {
        if (!activeCell) return null;
        if (colCount === 0 || rowCount === 0) return null;
        if (activeCell.col < colCount && activeCell.row < rowCount) {
          return activeCell;
        }
        return clampActiveCell(activeCell, colCount, rowCount);
      },
      { key: "CellEditingFeature.getActiveCell" },
    );

    table.setActiveCell = (position) => {
      recordGridUpdate(
        "setActiveCell",
        position
          ? { col: position.col, row: position.row }
          : { position: null },
      );
      table.setCellEditing((prev) => ({ ...prev, activeCell: position }));
    };

    table.getEditMode = memo(
      () => [
        table.getState().cellEditing.editMode,
        table.getVisibleLeafColumns().length,
        table.getRowModel().rows.length,
      ],
      (editMode, colCount, rowCount) => {
        if (colCount === 0 || rowCount === 0) return false;
        return editMode;
      },
      { key: "CellEditingFeature.getEditMode" },
    );

    table.startEditing = (mode = "full") => {
      recordGridUpdate("startEditing", { mode });
      table.setCellEditing((prev) => ({ ...prev, editMode: mode }));
    };

    table.stopEditing = () => {
      recordGridUpdate("stopEditing");
      table.setCellEditing((prev) => {
        if (!prev.editMode) return prev;
        return { ...prev, editMode: false };
      });
    };

    table.deleteSelection = () => {
      if (table.options.readOnly) return;
      if (!table.getSelection()) return;
      const onDelete = table.options.onDelete;
      if (table.isSelectionFullRows() && onDelete) {
        const rowsToDelete = collectSelectedRows(table);
        if (rowsToDelete.length) onDelete(rowsToDelete);
        return;
      }
      const onChange = table.options.onDataChange;
      if (onChange) void onChange(clearSelectedCells(table));
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

  createCell: <TData extends RowData, TValue>(
    cell: Cell<TData, TValue>,
    _column: Column<TData, TValue>,
    _row: Row<TData>,
    table: Table<TData>,
  ): void => {
    cell.isActive = () =>
      isCellActive(
        table.getActiveCell(),
        cell.column.getIndex(),
        cell.row.getVisualIndex(),
      );

    cell.isInteractive = () => cell.isActive() && table.isSingleCellSelection();

    cell.getEditMode = () =>
      cell.isInteractive() ? table.getEditMode() : false;
  },
};

function clampActiveCell(
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

function isCellActive(
  activeCell: CellPosition | null,
  col: number,
  row: number,
): boolean {
  if (!activeCell) return false;
  return activeCell.col === col && activeCell.row === row;
}

function collectSelectedRows<TData extends RowData>(
  table: Table<TData>,
): TData[] {
  const selection = table.getSelection();
  if (!selection) return [];
  const visibleRows = table.getRowModel().rows;
  const rows: TData[] = [];
  for (let i = selection.min.row; i <= selection.max.row; i++) {
    const row = visibleRows[i];
    if (row) rows.push(row.original);
  }
  return rows;
}

function clearSelectedCells<TData extends RowData>(
  table: Table<TData>,
): TData[] {
  const selection = table.getSelection();
  const data = table.options.data ?? [];
  if (!selection) return data;
  const visibleRows = table.getRowModel().rows;
  const columns = table.getVisibleLeafColumns();

  const targetRows = new Map<TData, number>();
  for (let i = selection.min.row; i <= selection.max.row; i++) {
    const row = visibleRows[i];
    if (row) targetRows.set(row.original, i);
  }

  const patchRow: PatchRowFn = table.options.patchRow ?? defaultPatchRow;

  return data.map((row, dataIndex) => {
    const visibleIndex = targetRows.get(row);
    if (visibleIndex === undefined) return row;

    const patches: Record<string, unknown> = {};
    for (
      let colIndex = selection.min.col;
      colIndex <= selection.max.col;
      colIndex++
    ) {
      const column = columns[colIndex];
      // Read-only rules address rows by data index; `visibleIndex` is the
      // sorted position, so use the data-array index here.
      if (!column || column.isReadOnly(dataIndex)) continue;

      const accessorKey = column.id;
      if (!accessorKey) continue;

      const deleteValue = column.getDeleteValue();
      if (deleteValue === undefined) continue;
      const value =
        typeof deleteValue === "function" ? deleteValue() : deleteValue;
      patches[accessorKey] = value ?? null;
    }
    return patchRow(row, patches);
  });
}
