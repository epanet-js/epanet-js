import { forwardRef, useRef } from "react";
import { Table } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  CellContextAction,
  DataGridVariant,
  GutterContextAction,
  RowAction,
} from "../types";
import {
  useContainerHeight,
  useContextMenuTarget,
  useGridKeyboard,
  useHeaderScrollSync,
  useScrollActiveCellIntoView,
  useScrollState,
} from "../hooks";
import { FIXED_COLUMN_SIZE, ROW_HEIGHT } from "./dimensions";
import { GridHeader } from "./grid-header";
import { GridRef } from "./types";
import { GridContextMenuWrapper } from "./grid-context-menu-shell";
import { ScrollShadows } from "./scroll-shadows";
import { VirtualRows } from "./virtual-rows";
import { recordGridUpdate } from "../update-loop-probe";

export type VirtualGridProps<TData extends Record<string, unknown>> = {
  table: Table<TData>;
  onCellMouseDown: (col: number, row: number, e: React.MouseEvent) => void;
  onCellMouseEnter: (col: number, row: number) => void;
  onCellDoubleClick: (col: number) => void;
  onCellContextMenu?: (col: number, row: number, e: React.MouseEvent) => void;
  onGutterClick: (row: number, e: React.MouseEvent) => void;
  onGutterContextMenu?: (row: number, e: React.MouseEvent) => void;
  onCellChange: (rowIndex: number, columnId: string, value: unknown) => void;
  onEmptyAreaMouseDown: (e: React.MouseEvent) => void;
  selectCells: (options?: {
    colIndex?: number;
    rowIndex?: number;
    extend?: boolean;
  }) => void;
  clearSelection: () => void;
  blurGrid: () => void;
  gutterColumn: boolean;
  showRowNumbers: boolean;
  rowActions?: RowAction[];
  readOnly: boolean;
  variant: DataGridVariant;
  cellHasWarning?: (rowIndex: number, columnId: string) => boolean;
  onColumnHeaderClick: (colIndex: number, e: React.MouseEvent) => void;
  onSelectAll: () => void;
  onColumnSort?: (columnId: string, direction: "asc" | "desc") => void;
  cellContextActions?: CellContextAction<TData>[];
  gutterContextActions?: GutterContextAction<TData>[];
};

export const VirtualGrid = forwardRef(function VirtualGrid<
  TData extends Record<string, unknown>,
>(
  {
    table,
    onCellMouseDown,
    onCellMouseEnter,
    onCellDoubleClick,
    onCellContextMenu,
    onGutterClick,
    onGutterContextMenu,
    onEmptyAreaMouseDown,
    onCellChange,
    selectCells,
    clearSelection,
    blurGrid,
    gutterColumn,
    showRowNumbers,
    rowActions,
    readOnly,
    variant,
    cellHasWarning,
    onColumnHeaderClick,
    onSelectAll,
    onColumnSort,
    cellContextActions,
    gutterContextActions,
  }: VirtualGridProps<TData>,
  ref: React.ForwardedRef<GridRef>,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);

  const rowsHeight = useContainerHeight(containerRef);
  const scrollState = useScrollState(scrollRef);
  const onScroll = useHeaderScrollSync(scrollRef, headerScrollRef);

  useScrollActiveCellIntoView({
    scrollRef,
    table,
    gutterColumn,
    rowHeight: ROW_HEIGHT,
  });

  const visibleRowCount = rowsHeight ? Math.floor(rowsHeight / ROW_HEIGHT) : 10;

  useGridKeyboard({
    ref,
    table,
    selectCells,
    clearSelection,
    blurGrid,
    visibleRowCount,
  });

  const {
    menuTarget,
    clearMenuTarget,
    wrappedCellContextMenu,
    wrappedGutterContextMenu,
  } = useContextMenuTarget({ onCellContextMenu, onGutterContextMenu });

  const rowVirtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
    onChange: (instance, sync) => {
      recordGridUpdate("virtualizer.onChange", {
        sync,
        offset: instance.scrollOffset,
        start: instance.range?.startIndex,
        end: instance.range?.endIndex,
        count: instance.options.count,
      });
    },
  });

  const gutterWidth = gutterColumn ? FIXED_COLUMN_SIZE : 0;
  const actionsWidth = rowActions ? FIXED_COLUMN_SIZE : 0;
  // Sum widths of all left-pinned columns so the left scroll shadow lands
  // at the pinned block's right edge.
  const pinnedLeftWidth = table
    .getLeftLeafColumns()
    .reduce((sum, col) => sum + col.getSize(), 0);
  const isReady = rowsHeight !== undefined;

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 flex flex-col datagrid-scroll-container"
      style={{ visibility: isReady ? "visible" : "hidden" }}
    >
      <div
        ref={headerScrollRef}
        className="shrink-0 overflow-hidden border-t border-x border-base"
      >
        <GridHeader
          table={table}
          showGutterColumn={gutterColumn}
          showActionsColumn={!readOnly && !!rowActions}
          onColumnHeaderClick={onColumnHeaderClick}
          onSelectAll={onSelectAll}
          variant={variant}
          scrollbarGap={scrollState.scrollbarWidth}
          onColumnSort={onColumnSort}
        />
      </div>

      <GridContextMenuWrapper
        table={table}
        cellContextActions={cellContextActions}
        gutterContextActions={gutterContextActions}
        readOnly={readOnly}
        menuTarget={menuTarget}
        onClose={clearMenuTarget}
      >
        <div
          ref={scrollRef}
          onMouseDown={onEmptyAreaMouseDown}
          onContextMenu={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
          onScroll={onScroll}
          className="outline-hidden overflow-auto overscroll-none flex-1 border border-base datagrid-scroll-area"
        >
          <VirtualRows
            rowVirtualizer={rowVirtualizer}
            table={table}
            hasVerticalScroll={scrollState.hasVerticalScroll}
            onCellMouseDown={onCellMouseDown}
            onCellMouseEnter={onCellMouseEnter}
            onCellDoubleClick={onCellDoubleClick}
            onCellContextMenu={wrappedCellContextMenu}
            onGutterClick={onGutterClick}
            onGutterContextMenu={wrappedGutterContextMenu}
            onCellChange={onCellChange}
            gutterColumn={gutterColumn}
            showRowNumbers={showRowNumbers}
            rowActions={rowActions}
            readOnly={readOnly}
            variant={variant}
            cellHasWarning={cellHasWarning}
          />
        </div>
      </GridContextMenuWrapper>

      <ScrollShadows
        scrollState={scrollState}
        gutterWidth={gutterWidth}
        actionsWidth={actionsWidth}
        rowHeight={ROW_HEIGHT}
        pinnedLeftWidth={pinnedLeftWidth}
      />
    </div>
  );
}) as <TData extends Record<string, unknown>>(
  props: VirtualGridProps<TData> & { ref?: React.Ref<GridRef> },
) => React.ReactElement;
