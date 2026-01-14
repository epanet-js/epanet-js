import { floatColumn, Column } from "react-datasheet-grid";

export const createFloatColumn = (): Partial<Column<number | null>> => ({
  ...floatColumn,
  cellClassName: "tabular-nums",
});
