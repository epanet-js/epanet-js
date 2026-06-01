import { useRef, useState } from "react";
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
import { resolveVisibleHeaderActions } from "../features";

type GridHeaderProps<T> = {
  showGutterColumn: boolean;
  showActionsColumn: boolean;
  table: Table<T>;
  onColumnHeaderClick: (colIndex: number, e: React.MouseEvent) => void;
  onSelectAll: () => void;
  variant: DataGridVariant;
  style?: React.CSSProperties;
  className?: string;
  scrollbarGap?: number;
  onColumnSort?: (columnId: string, direction: "asc" | "desc") => void;
};

export function GridHeader<T>({
  showGutterColumn,
  showActionsColumn,
  table,
  onColumnHeaderClick,
  onSelectAll,
  variant,
  style,
  className,
  scrollbarGap,
  onColumnSort,
}: GridHeaderProps<T>) {
  const translate = useTranslate();

  const selection = table.getSelection();
  const rowCount = table.getRowModel().rows.length;
  const allRowsSelected =
    variant === "spreadsheet" &&
    selection !== null &&
    rowCount > 0 &&
    selection.min.row === 0 &&
    selection.max.row === rowCount - 1;

  const isColSelected = (colIndex: number) =>
    allRowsSelected &&
    colIndex >= selection.min.col &&
    colIndex <= selection.max.col;

  return (
    <div
      role="row"
      className={clsx(
        "flex shrink-0 min-w-full w-max",
        "border border-transparent",
        className,
        {
          "bg-base-hover border-t-[--color-border] border-x-[--color-border]":
            variant === "spreadsheet",
          "bg-panel": variant === "inline",
        },
      )}
      style={style}
    >
      {showGutterColumn && (
        <div
          role="columnheader"
          className={clsx(
            "relative flex items-center justify-center font-semibold text-size-base shrink-0 cursor-pointer select-none h-8 sticky left-0 z-10",
            "border border-transparent w-8",
            "text-subtle",
            variant === "spreadsheet" ? "bg-base-hover" : "bg-panel",
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
              isSelected={isColSelected(colIndex)}
              onColumnHeaderClick={onColumnHeaderClick}
              translate={translate}
              onColumnSort={onColumnSort}
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
  isSelected,
  onColumnHeaderClick,
  translate,
  onColumnSort,
}: {
  header: Header<T, unknown>;
  colIndex: number;
  isSelected: boolean;
  onColumnHeaderClick: (colIndex: number, e: React.MouseEvent) => void;
  translate: (key: string) => string;
  onColumnSort?: (columnId: string, direction: "asc" | "desc") => void;
}) {
  const cellRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const hasActions = header.column.getCanSort();
  const sortDirection = header.column.getIsSorted();
  const customHeaderActions = header.column.getCustomHeaderActions?.();
  const visibleCustomActions = resolveVisibleHeaderActions(
    customHeaderActions,
    isHovered,
  );
  const hasCustomActions = visibleCustomActions.length > 0;
  const showActionsMenu =
    !hasCustomActions && (isHovered || isMenuOpen) && hasActions;

  return (
    <div
      ref={cellRef}
      role="columnheader"
      className={clsx(
        "group relative flex items-center px-2 font-semibold text-size-base cursor-pointer select-none h-8 border border-transparent overflow-visible",
        { grow: !header.column.getCanResize() },
        isSelected ? "bg-accent text-white" : "text-subtle",
      )}
      style={{
        width: header.getSize(),
        minWidth: header.getSize(),
      }}
      onClick={(e) => onColumnHeaderClick(colIndex, e)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className="truncate">
        {flexRender(header.column.columnDef.header, header.getContext())}
      </span>
      {sortDirection && !showActionsMenu && !hasCustomActions && (
        <span className="ml-auto shrink-0 -mr-1 h-6 w-6 flex items-center justify-center">
          {sortDirection === "asc" ? (
            <SortAscendingIcon size="md" />
          ) : (
            <SortDescendingIcon size="md" />
          )}
        </span>
      )}
      {hasCustomActions && (
        <span className="ml-auto shrink-0 -mr-1 flex items-center">
          {visibleCustomActions.map((action, idx) => (
            <button
              key={idx}
              type="button"
              aria-label={action.ariaLabel}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                action.onClick();
              }}
              className={clsx(
                "h-6 w-6 flex items-center justify-center rounded-xs",
                isSelected
                  ? "text-white hover:bg-white/20"
                  : "text-gray-600 hover:bg-gray-200",
              )}
            >
              {action.icon}
            </button>
          ))}
        </span>
      )}
      {showActionsMenu && (
        <HeaderActionsButton
          onSortAscending={() => {
            header.column.toggleSorting(false);
            onColumnSort?.(header.column.id, "asc");
          }}
          onSortDescending={() => {
            header.column.toggleSorting(true);
            onColumnSort?.(header.column.id, "desc");
          }}
          onOpenChange={(open) => {
            setIsMenuOpen(open);
            if (!open) {
              requestAnimationFrame(() => {
                setIsHovered(cellRef.current?.matches(":hover") ?? false);
              });
            }
          }}
          isSelected={isSelected}
          translate={translate}
        />
      )}
      {header.column.getCanResize() && (
        <ColumnResizer
          onMouseDown={header.getResizeHandler()}
          onDoubleClick={() => header.column.fitWidthToContent?.()}
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
        "absolute right-[-3px] top-0 h-full w-1 cursor-col-resize select-none touch-none z-10",
        isResizing
          ? "bg-accent"
          : "bg-gray-300 opacity-0 group-hover:opacity-100",
      )}
    />
  );
}

function HeaderActionsButton({
  onSortAscending,
  onSortDescending,
  onOpenChange,
  isSelected,
  translate,
}: {
  onSortAscending: () => void;
  onSortDescending: () => void;
  onOpenChange: (open: boolean) => void;
  isSelected: boolean;
  translate: (key: string) => string;
}) {
  return (
    <DD.Root modal={false} onOpenChange={onOpenChange}>
      <DD.Trigger asChild>
        <Button
          variant="quiet"
          size="xs"
          aria-label={translate("moreActions")}
          className={clsx(
            "ml-auto -mr-1 h-6 w-6 shrink-0",
            isSelected
              ? "text-white hover:bg-white/20 data-[state=open]:bg-white/20"
              : "hover:bg-base-active",
          )}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreActionsIcon size="md" />
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
