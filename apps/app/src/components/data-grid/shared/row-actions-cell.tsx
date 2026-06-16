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
  if (!rowActions) return null;

  const visibleActions = rowActions.filter(
    (action) => !action.hidden?.(rowIndex),
  );

  return (
    <div
      role="gridcell"
      onFocus={(e) => e.stopPropagation()}
      className={clsx(
        "sticky right-0 shrink-0 w-8 h-8 bg-base z-10",
        "border-r-0",
        variant === "spreadsheet" ? "border-l" : "border-l-0",
        variant === "inline" && rowIndex === 0 ? "border-t" : "border-t-0",
        variant === "inline" || (variant === "spreadsheet" && !isLastRow)
          ? "border-b"
          : "border-b-0",
      )}
    >
      {visibleActions.length > 0 && (
        <ActionsCell
          rowIndex={rowIndex}
          actions={visibleActions}
          disabled={disabled}
        />
      )}
    </div>
  );
}
