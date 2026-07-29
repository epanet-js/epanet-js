import type {
  Column,
  RowData,
  Table,
  TableFeature,
} from "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    defaultValue?: TValue | ((rowIndex: number) => TValue);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Column<TData extends RowData, TValue> {
    getDefaultValue: (rowIndex: number) => TValue | undefined;
    getEffectiveValue: (raw: TValue, rowIndex: number) => TValue;
  }
}

export const DefaultValueFeature: TableFeature = {
  createColumn: <TData extends RowData>(
    column: Column<TData, unknown>,
    _table: Table<TData>,
  ): void => {
    column.getDefaultValue = (rowIndex) => {
      const def = column.columnDef.meta?.defaultValue;
      return typeof def === "function"
        ? (def as (rowIndex: number) => unknown)(rowIndex)
        : def;
    };
    column.getEffectiveValue = (raw, rowIndex) =>
      raw == null ? (column.getDefaultValue(rowIndex) ?? raw) : raw;
  },
};
