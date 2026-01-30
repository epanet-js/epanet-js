import clsx from "clsx";
import { DataGridVariant } from "../types";

type RowGutterCellProps = {
  rowIndex: number;
  onClick: (e: React.MouseEvent) => void;
  variant: DataGridVariant;
  isLastRow: boolean;
};

export function RowGutterCell({
  rowIndex,
  onClick,
  variant,
  isLastRow,
}: RowGutterCellProps) {
  return (
    <div
      role="rowheader"
      className={clsx(
        "flex items-center justify-center text-xs shrink-0 cursor-pointer select-none h-8 text-gray-600 sticky left-0 z-10",
        "border border-transparent",
        { "w-10": variant === "spreadsheet", "w-8": variant === "rows" },
        { "border-b-gray-200": variant === "spreadsheet" && !isLastRow },
        {
          "bg-gray-100": variant === "spreadsheet",
          "bg-gray-50": variant === "rows",
        },
      )}
      onClick={onClick}
    >
      {rowIndex + 1}
    </div>
  );
}
