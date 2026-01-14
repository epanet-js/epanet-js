import { floatColumn, Column } from "react-datasheet-grid";

type FloatColumnOptions = {
  deleteValue?: number | null;
};

export const createFloatColumn = (
  options?: FloatColumnOptions,
): Partial<Column<number | null>> => ({
  ...floatColumn,
  cellClassName: "tabular-nums",
  deleteValue: () => options?.deleteValue ?? null,
});
