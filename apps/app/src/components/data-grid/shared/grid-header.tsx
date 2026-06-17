import { useRef, useState } from "react";
import { Table, flexRender, Header } from "@tanstack/react-table";
import * as DD from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
import clsx from "clsx";
import {
  MoreActionsIcon,
  SortAscendingIcon,
  SortDescendingIcon,
  TableSelectAllIcon,
} from "src/icons";
import {
  Button,
  DDContent,
  StyledItem,
  TContent,
  StyledTooltipArrow,
} from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";
import { DataGridVariant } from "../types";
import { resolveVisibleHeaderActions } from "../features";
import { FIXED_COLUMN_SIZE } from "./dimensions";
import { useGridBusy } from "./grid-busy";

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
      className={clsx("flex shrink-0 min-w-full w-max bg-panel", className)}
      style={style}
    >
      {showGutterColumn && (
        <div
          role="columnheader"
          className={clsx(
            "relative flex items-center justify-center font-semibold text-size-base shrink-0 cursor-pointer select-none h-8 sticky left-0 z-10",
            "border border-transparent w-8",
            "text-subtle",
            "bg-panel",
          )}
          onClick={onSelectAll}
        >
          <TableSelectAllIcon className="absolute bottom-1 right-1" />
        </div>
      )}
      {table.getHeaderGroups().map((headerGroup) => {
        let pinnedLeftCursor = showGutterColumn ? FIXED_COLUMN_SIZE : 0;
        return headerGroup.headers.map((header, colIndex) => {
          const isPinnedLeft = header.column.getIsPinned() === "left";
          const pinnedLeftOffset = isPinnedLeft ? pinnedLeftCursor : undefined;
          if (isPinnedLeft) pinnedLeftCursor += header.getSize();
          return (
            <HeaderCell
              key={header.id}
              header={header}
              colIndex={colIndex}
              isSelected={isColSelected(colIndex)}
              onColumnHeaderClick={onColumnHeaderClick}
              translate={translate}
              onColumnSort={onColumnSort}
              pinnedLeftOffset={pinnedLeftOffset}
            />
          );
        });
      })}
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
  pinnedLeftOffset,
}: {
  header: Header<T, unknown>;
  colIndex: number;
  isSelected: boolean;
  onColumnHeaderClick: (colIndex: number, e: React.MouseEvent) => void;
  translate: (key: string) => string;
  onColumnSort?: (columnId: string, direction: "asc" | "desc") => void;
  pinnedLeftOffset?: number;
}) {
  const cellRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { runBusy } = useGridBusy();
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
  // Mirror the pinned-left treatment from grid-data-cell so the header
  // sticks at the same offset as its column.
  const isPinnedLeft = header.column.getIsPinned() === "left";

  return (
    <div
      ref={cellRef}
      role="columnheader"
      className={clsx(
        "group relative flex items-center px-2 font-semibold text-size-base cursor-pointer select-none h-8 border border-transparent overflow-visible",
        { grow: !header.column.getCanResize() },
        isPinnedLeft && "sticky z-5",
        !isSelected && "bg-panel",
        isSelected ? "bg-accent text-white" : "text-subtle",
      )}
      style={{
        width: header.getSize(),
        minWidth: header.getSize(),
        ...(isPinnedLeft
          ? {
              left: pinnedLeftOffset ?? 0,
              ...(isSelected
                ? undefined
                : { borderRightColor: "var(--color-border)" }),
            }
          : undefined),
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
          {visibleCustomActions.map((action, idx) => {
            const button = (
              <button
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
            );
            return action.tooltip ? (
              <Tooltip.Root key={idx} delayDuration={200}>
                <Tooltip.Trigger asChild>{button}</Tooltip.Trigger>
                <Tooltip.Portal>
                  <TContent side="top">
                    <StyledTooltipArrow />
                    {action.tooltip}
                  </TContent>
                </Tooltip.Portal>
              </Tooltip.Root>
            ) : (
              <span key={idx}>{button}</span>
            );
          })}
        </span>
      )}
      {showActionsMenu && (
        <HeaderActionsButton
          onSortAscending={() =>
            runBusy(() => {
              header.column.toggleSorting(false);
              onColumnSort?.(header.column.id, "asc");
            })
          }
          onSortDescending={() =>
            runBusy(() => {
              header.column.toggleSorting(true);
              onColumnSort?.(header.column.id, "desc");
            })
          }
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
              : "hover:bg-base-hover",
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
