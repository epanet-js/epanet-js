import { Table, flexRender } from "@tanstack/react-table";
import * as CM from "@radix-ui/react-context-menu";
import clsx from "clsx";
import {
  SortAscendingIcon,
  SortDescendingIcon,
  TableSelectAllIcon,
} from "src/icons";
import { CMContent, CMItem } from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";
import { DataGridVariant } from "../types";

type GridHeaderProps<T> = {
  showGutterColumn: boolean;
  showActionsColumn: boolean;
  table: Table<T>;
  onSelectColumn: (colIndex: number) => void;
  onSelectAll: () => void;
  variant: DataGridVariant;
  style?: React.CSSProperties;
  className?: string;
  scrollbarGap?: number;
  resetColumnSize?: (columnId: string) => void;
};

export function GridHeader<T>({
  showGutterColumn,
  showActionsColumn,
  table,
  onSelectColumn,
  onSelectAll,
  variant,
  style,
  className,
  scrollbarGap,
  resetColumnSize,
}: GridHeaderProps<T>) {
  const translate = useTranslate();
  return (
    <div
      role="row"
      className={clsx(
        "flex shrink-0 min-w-full w-max",
        "border border-transparent",
        className,
        {
          "bg-gray-100 border-t-gray-200 border-x-gray-200":
            variant === "spreadsheet",
          "bg-gray-50": variant === "inline",
        },
      )}
      style={style}
    >
      {showGutterColumn && (
        <div
          role="columnheader"
          className={clsx(
            "relative flex items-center justify-center font-semibold text-sm shrink-0 cursor-pointer select-none h-8 text-gray-600 sticky left-0 z-10",
            "border border-transparent w-8",
            {
              "bg-gray-100": variant === "spreadsheet",
              "bg-gray-50": variant === "inline",
            },
          )}
          onClick={onSelectAll}
        >
          <TableSelectAllIcon className="absolute bottom-1 right-1" />
        </div>
      )}
      {table.getHeaderGroups().map((headerGroup) =>
        headerGroup.headers.map((header, colIndex) => {
          const sorted = header.column.getIsSorted();
          const canSort = header.column.getCanSort();
          const cell = (
            <div
              role="columnheader"
              className={clsx(
                "group relative flex items-center px-2 font-semibold text-sm cursor-pointer select-none h-8 text-gray-600 border border-transparent overflow-visible",
                { grow: !header.column.getCanResize() },
              )}
              style={{
                width: header.getSize(),
                minWidth: header.getSize(),
              }}
              onClick={() => onSelectColumn(colIndex)}
            >
              <span className="truncate">
                {flexRender(
                  header.column.columnDef.header,
                  header.getContext(),
                )}
              </span>
              {sorted === "asc" && (
                <SortAscendingIcon className="ml-1 shrink-0 text-gray-500" />
              )}
              {sorted === "desc" && (
                <SortDescendingIcon className="ml-1 shrink-0 text-gray-500" />
              )}
              {header.column.getCanResize() && (
                <div
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    header.getResizeHandler()(e);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    resetColumnSize?.(header.column.id);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className={clsx(
                    "absolute -right-[3px] top-0 h-full w-1 cursor-col-resize select-none touch-none z-10",
                    header.column.getIsResizing()
                      ? "bg-purple-500"
                      : "bg-gray-300 opacity-0 group-hover:opacity-100",
                  )}
                />
              )}
            </div>
          );

          if (!canSort) return cell;

          return (
            <CM.Root key={header.id}>
              <CM.Trigger asChild>{cell}</CM.Trigger>
              <CM.Portal>
                <CMContent>
                  <CMItem onSelect={() => header.column.toggleSorting(false)}>
                    <SortAscendingIcon />
                    {translate("sortAscending")}
                  </CMItem>
                  <CMItem onSelect={() => header.column.toggleSorting(true)}>
                    <SortDescendingIcon />
                    {translate("sortDescending")}
                  </CMItem>
                </CMContent>
              </CM.Portal>
            </CM.Root>
          );
        }),
      )}
      {showActionsColumn && (
        <div
          role="columnheader"
          className={clsx(
            "shrink-0 sticky right-0 w-8 h-8 z-10 border border-transparent",
          )}
        />
      )}
      {!!scrollbarGap && (
        <div className="shrink-0" style={{ width: scrollbarGap }} />
      )}
    </div>
  );
}
