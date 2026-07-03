import type {
  Column,
  RowData,
  Table,
  TableFeature,
} from "@tanstack/react-table";
import type { ComponentType } from "react";
import type { CellProps } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CellComponent = ComponentType<CellProps<any>>;

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    cellComponent?: ComponentType<CellProps<TValue>>;
    hasWarning?: (value: TValue) => boolean;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Column<TData extends RowData, TValue> {
    getCellComponent: () => CellComponent | undefined;
    hasWarning: (value: TValue) => boolean;
  }
}

export const CellRenderingFeature: TableFeature = {
  createColumn: <TData extends RowData>(
    column: Column<TData, unknown>,
    _table: Table<TData>,
  ): void => {
    column.getCellComponent = () => column.columnDef.meta?.cellComponent;
    column.hasWarning = (value) =>
      column.columnDef.meta?.hasWarning?.(value) ?? false;
  },
};
