import * as CM from "@radix-ui/react-context-menu";
import clsx from "clsx";
import { DataGridVariant } from "../types";
import {
  GutterContextMenuConfig,
  GutterContextMenuContent,
} from "./grid-context-menus";

type RowGutterCellProps<TData extends Record<string, unknown>> = {
  rowIndex: number;
  onClick: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  variant: DataGridVariant;
  isLastRow: boolean;
  showRowNumbers?: boolean;
  isRowSelected?: boolean;
  gutterContextMenu?: GutterContextMenuConfig<TData>;
};

export function RowGutterCell<TData extends Record<string, unknown>>({
  rowIndex,
  onClick,
  onContextMenu,
  variant,
  isLastRow: _isLastRow,
  showRowNumbers = true,
  isRowSelected = false,
  gutterContextMenu,
}: RowGutterCellProps<TData>) {
  const cellNode = (
    <div
      role="rowheader"
      className={clsx(
        "flex items-center justify-center text-xs shrink-0 cursor-pointer select-none h-8 sticky left-0 z-10",
        isRowSelected && variant === "spreadsheet"
          ? "text-white"
          : "text-gray-600",
        "border border-transparent w-8",
        {
          "border-b-gray-200": variant === "spreadsheet" || !showRowNumbers,
        },
        isRowSelected && variant === "spreadsheet"
          ? "bg-purple-500"
          : {
              "bg-gray-100": variant === "spreadsheet",
              "bg-gray-50": variant === "inline",
            },
      )}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {showRowNumbers ? rowIndex + 1 : null}
    </div>
  );

  if (!gutterContextMenu || gutterContextMenu.actions.length === 0)
    return cellNode;

  return (
    <CM.Root>
      <CM.Trigger asChild>{cellNode}</CM.Trigger>
      <GutterContextMenuContent {...gutterContextMenu} rowIndex={rowIndex} />
    </CM.Root>
  );
}
