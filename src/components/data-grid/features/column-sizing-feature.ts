import type {
  Column,
  RowData,
  Table,
  TableFeature,
} from "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    autoSizeExtraWidth?: number;
    placeholder?: string;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Column<TData extends RowData, TValue> {
    getAutoSizeExtraWidth: () => number;
    getPlaceholder: () => string | undefined;
  }
}

const DEFAULT_AUTO_SIZE_EXTRA_WIDTH = 16;

export const ColumnSizingFeature: TableFeature = {
  createColumn: <TData extends RowData>(
    column: Column<TData, unknown>,
    _table: Table<TData>,
  ): void => {
    column.getAutoSizeExtraWidth = () =>
      column.columnDef.meta?.autoSizeExtraWidth ??
      DEFAULT_AUTO_SIZE_EXTRA_WIDTH;

    column.getPlaceholder = () => column.columnDef.meta?.placeholder;
  },
};
