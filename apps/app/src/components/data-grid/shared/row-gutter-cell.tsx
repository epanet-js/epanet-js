import clsx from "clsx";
import { DataGridVariant } from "../types";

type RowGutterCellProps = {
  rowIndex: number;
  onClick: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  variant: DataGridVariant;
  isLastRow: boolean;
  showRowNumbers?: boolean;
  isRowSelected?: boolean;
};

export function RowGutterCell({
  rowIndex,
  onClick,
  onContextMenu,
  variant,
  isLastRow,
  showRowNumbers = true,
  isRowSelected = false,
}: RowGutterCellProps) {
  return (
    <div
      role="rowheader"
      className={clsx(
        "flex items-center justify-center text-size-small shrink-0 cursor-pointer select-none h-8 sticky left-0 z-10",
        isRowSelected && variant === "spreadsheet"
          ? "text-white"
          : "text-subtle",
        "border border-transparent w-8",
        {
          "border-b-[--color-border]":
            (variant === "spreadsheet" && isLastRow) || !showRowNumbers,
        },
        isRowSelected && variant === "spreadsheet"
          ? "bg-accent"
          : {
              "bg-base-hover": variant === "spreadsheet",
              "bg-panel": variant === "inline",
            },
      )}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {showRowNumbers ? rowIndex + 1 : null}
    </div>
  );
}
