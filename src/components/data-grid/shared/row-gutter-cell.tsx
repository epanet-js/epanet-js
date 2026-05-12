import clsx from "clsx";
import { DataGridVariant } from "../types";

type RowGutterCellProps = {
  rowIndex: number;
  onClick: (e: React.MouseEvent) => void;
  variant: DataGridVariant;
  isLastRow: boolean;
  showRowNumbers?: boolean;
  isRowSelected?: boolean;
};

export function RowGutterCell({
  rowIndex,
  onClick,
  variant,
  isLastRow,
  showRowNumbers = true,
  isRowSelected = false,
}: RowGutterCellProps) {
  return (
    <div
      role="rowheader"
      className={clsx(
        "flex items-center justify-center text-xs shrink-0 cursor-pointer select-none h-8 sticky left-0 z-10",
        isRowSelected && variant === "spreadsheet"
          ? "text-white"
          : "text-gray-600",
        "border border-transparent w-8",
        {
          "border-b-gray-200":
            (variant === "spreadsheet" && isLastRow) || !showRowNumbers,
        },
        isRowSelected && variant === "spreadsheet"
          ? "bg-purple-500"
          : {
              "bg-gray-100": variant === "spreadsheet",
              "bg-gray-50": variant === "inline",
            },
      )}
      onClick={onClick}
    >
      {showRowNumbers ? rowIndex + 1 : null}
    </div>
  );
}
