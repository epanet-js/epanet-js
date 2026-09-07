import type { RowData, Table, TableState } from "@tanstack/react-table";
import type { DataGridState } from "../types";

export const clampDataGridStateToRowCount = (
  state: DataGridState | undefined,
  rowCount: number,
): DataGridState | undefined => {
  if (!state) return undefined;
  if (rowCount === 0) return { ...state, selection: null, activeCell: null };

  const lastRow = rowCount - 1;
  const clampRow = (row: number) => Math.min(Math.max(row, 0), lastRow);

  return {
    ...state,
    selection: state.selection
      ? {
          ...state.selection,
          min: {
            ...state.selection.min,
            row: clampRow(state.selection.min.row),
          },
          max: {
            ...state.selection.max,
            row: clampRow(state.selection.max.row),
          },
        }
      : state.selection,
    activeCell: state.activeCell
      ? { ...state.activeCell, row: clampRow(state.activeCell.row) }
      : state.activeCell,
  };
};

export const toInitialTableState = (
  saved: DataGridState | undefined,
  rowCount: number,
): Partial<TableState> => {
  const state = clampDataGridStateToRowCount(saved, rowCount);
  if (!state) return {};
  return {
    ...(state.sorting ? { sorting: state.sorting } : {}),
    ...(state.columnSizing ? { columnSizing: state.columnSizing } : {}),
    ...(state.selection !== undefined
      ? { cellRangeSelection: { range: state.selection } }
      : {}),
    ...(state.activeCell !== undefined
      ? { cellEditing: { activeCell: state.activeCell, editMode: false } }
      : {}),
  };
};

export const captureGridState = <TData extends RowData>(
  table: Table<TData>,
  scrollOffset: { top: number; left: number },
): DataGridState => {
  const state = table.getState();
  return {
    sorting: state.sorting,
    columnSizing: state.columnSizing,
    selection: state.cellRangeSelection.range,
    activeCell: state.cellEditing.activeCell,
    scrollTop: scrollOffset.top,
    scrollLeft: scrollOffset.left,
  };
};

export const restoreGridScroll = (
  scrollElement: HTMLElement | null,
  state: DataGridState | undefined,
): void => {
  if (!scrollElement || !state) return;
  if (state.scrollTop !== undefined) scrollElement.scrollTop = state.scrollTop;
  if (state.scrollLeft !== undefined) {
    scrollElement.scrollLeft = state.scrollLeft;
  }
};
