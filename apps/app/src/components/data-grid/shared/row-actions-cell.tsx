import clsx from "clsx";
import { DataGridVariant, RowAction } from "../types";
import { ActionsCell } from "../cells/actions-cell";

type RowActionsCellProps = {
  rowIndex: number;
  rowActions?: RowAction[];
  variant: DataGridVariant;
  isLastRow: boolean;
  disabled?: boolean;
};

export function RowActionsCell({
  rowIndex,
  rowActions,
  variant,
  isLastRow,
  disabled = false,
}: RowActionsCellProps) {
  return rowActions ? (
    <div
      role="gridcell"
      onFocus={(e) => e.stopPropagation()}
      className={clsx(
        "sticky right-0 shrink-0 w-8 h-8 bg-base z-10",
        "border border-transparent",
        {
          "border-t-[--color-border]": variant === "inline" && rowIndex === 0,
        },
        {
          "border-b-[--color-border]":
            variant === "inline" || (variant === "spreadsheet" && !isLastRow),
        },
        { "border-l-[--color-border]": variant === "spreadsheet" },
      )}
    >
      <ActionsCell
        rowIndex={rowIndex}
        actions={rowActions}
        disabled={disabled}
      />
    </div>
  ) : null;
}
