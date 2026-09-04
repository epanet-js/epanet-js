import type { ColumnSizingState, SortingState } from "@tanstack/react-table";
import type { CellPosition, GridSelection } from "src/components/data-grid";

export type DataGridState = {
  sorting?: SortingState;
  columnSizing?: ColumnSizingState;
  selection?: GridSelection | null;
  activeCell?: CellPosition | null;
  scrollTop?: number;
  scrollLeft?: number;
};

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
