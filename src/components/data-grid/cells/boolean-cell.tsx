import { filterableSelectColumn } from "./filterable-select-cell";
import type { GridColumn } from "../types";

export function booleanColumn(
  accessorKey: string,
  options: {
    header: string;
    size?: number;
    trueLabel: string;
    falseLabel: string;
    isReadOnly?: boolean;
  },
): GridColumn {
  return filterableSelectColumn<boolean>(accessorKey, {
    header: options.header,
    size: options.size,
    options: [
      { value: true, label: options.trueLabel },
      { value: false, label: options.falseLabel },
    ],
    deleteValue: false,
    minOptionsForSearch: Infinity,
    isReadOnly: options.isReadOnly,
  });
}
