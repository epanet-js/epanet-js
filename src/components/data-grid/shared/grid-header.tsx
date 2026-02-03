import { Table, flexRender } from "@tanstack/react-table";
import clsx from "clsx";
import { TableSelectAllIcon } from "src/icons";
import { DataGridVariant } from "../types";

type GridHeaderProps<T> = {
  showGutterColumn: boolean;
  showActionsColumn: boolean;
  table: Table<T>;
  onSelectColumn: (colIndex: number) => void;
  onSelectAll: () => void;
  variant: DataGridVariant;
  style?: React.CSSProperties;
};

export function GridHeader<T>({
  showGutterColumn,
  showActionsColumn,
  table,
  onSelectColumn,
  onSelectAll,
  variant,
  style,
}: GridHeaderProps<T>) {
  return (
    <div
      role="row"
      className={clsx("flex shrink-0 z-10", "border border-transparent", {
        "bg-gray-100 border-t-gray-200 border-x-gray-200":
          variant === "spreadsheet",
        "bg-gray-50": variant === "rows",
      })}
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
              "bg-gray-50": variant === "rows",
            },
          )}
          onClick={onSelectAll}
        >
          <TableSelectAllIcon className="absolute bottom-1 right-1" />
        </div>
      )}
      {table.getHeaderGroups().map((headerGroup) =>
        headerGroup.headers.map((header, colIndex) => (
          <div
            key={header.id}
            role="columnheader"
            className="flex items-center px-2 font-semibold text-sm cursor-pointer select-none h-8 grow min-w-0 text-gray-600 border border-transparent"
            style={{
              width: header.getSize(),
              minWidth: header.getSize(),
            }}
            onClick={() => onSelectColumn(colIndex)}
          >
            <span className="truncate">
              {flexRender(header.column.columnDef.header, header.getContext())}
            </span>
          </div>
        )),
      )}
      {showActionsColumn && (
        <div
          role="columnheader"
          className={clsx(
            "shrink-0 sticky right-0 w-8 h-8 z-10 border border-transparent",
          )}
        />
      )}
    </div>
  );
}
