import { useState } from "react";
import { Table, flexRender, Header } from "@tanstack/react-table";
import * as DD from "@radix-ui/react-dropdown-menu";
import clsx from "clsx";
import {
  MoreActionsIcon,
  SortAscendingIcon,
  SortDescendingIcon,
  TableSelectAllIcon,
} from "src/icons";
import { Button, DDContent, StyledItem } from "src/components/elements";
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
      {table
        .getHeaderGroups()
        .map((headerGroup) =>
          headerGroup.headers.map((header, colIndex) => (
            <HeaderCell
              key={header.id}
              header={header}
              colIndex={colIndex}
              onSelectColumn={onSelectColumn}
              resetColumnSize={resetColumnSize}
              translate={translate}
            />
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
      {!!scrollbarGap && (
        <div className="shrink-0" style={{ width: scrollbarGap }} />
      )}
    </div>
  );
}

function HeaderCell<T>({
  header,
  colIndex,
  onSelectColumn,
  resetColumnSize,
  translate,
}: {
  header: Header<T, unknown>;
  colIndex: number;
  onSelectColumn: (colIndex: number) => void;
  resetColumnSize?: (columnId: string) => void;
  translate: (key: string) => string;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const hasActions = header.column.getCanSort();

  return (
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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className="truncate">
        {flexRender(header.column.columnDef.header, header.getContext())}
      </span>
      {(isHovered || isMenuOpen) && hasActions && (
        <HeaderActionsButton
          onSortAscending={() => header.column.toggleSorting(false)}
          onSortDescending={() => header.column.toggleSorting(true)}
          onOpenChange={(open) => {
            setIsMenuOpen(open);
            if (!open) setIsHovered(false);
          }}
          translate={translate}
        />
      )}
      {header.column.getCanResize() && (
        <ColumnResizer
          onMouseDown={header.getResizeHandler()}
          onDoubleClick={() => resetColumnSize?.(header.column.id)}
          isResizing={header.column.getIsResizing()}
        />
      )}
    </div>
  );
}

function ColumnResizer({
  onMouseDown,
  onDoubleClick,
  isResizing,
}: {
  onMouseDown: (e: unknown) => void;
  onDoubleClick: () => void;
  isResizing: boolean;
}) {
  return (
    <div
      onMouseDown={(e) => {
        e.stopPropagation();
        onMouseDown(e);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick();
      }}
      onClick={(e) => e.stopPropagation()}
      className={clsx(
        "absolute -right-[3px] top-0 h-full w-1 cursor-col-resize select-none touch-none z-10",
        isResizing
          ? "bg-purple-500"
          : "bg-gray-300 opacity-0 group-hover:opacity-100",
      )}
    />
  );
}

function HeaderActionsButton({
  onSortAscending,
  onSortDescending,
  onOpenChange,
  translate,
}: {
  onSortAscending: () => void;
  onSortDescending: () => void;
  onOpenChange: (open: boolean) => void;
  translate: (key: string) => string;
}) {
  return (
    <DD.Root modal={false} onOpenChange={onOpenChange}>
      <DD.Trigger asChild>
        <Button
          variant="quiet"
          size="xs"
          aria-label={translate("moreActions")}
          className="ml-auto -mr-1 h-6 w-6 shrink-0 hover:bg-gray-200"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreActionsIcon size="sm" />
        </Button>
      </DD.Trigger>
      <DD.Portal>
        <DDContent
          align="start"
          side="bottom"
          className="z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <StyledItem onSelect={onSortAscending}>
            <SortAscendingIcon />
            {translate("sortAscending")}
          </StyledItem>
          <StyledItem onSelect={onSortDescending}>
            <SortDescendingIcon />
            {translate("sortDescending")}
          </StyledItem>
        </DDContent>
      </DD.Portal>
    </DD.Root>
  );
}
