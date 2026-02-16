import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Table } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  CellPosition,
  DataGridVariant,
  EditMode,
  GridColumn,
  GridSelection,
  RowAction,
} from "../types";
import { useRowsNavigation } from "../hooks";
import { GridRow } from "./grid-row";
import { RowsRef } from "./rows";

export const ROW_HEIGHT = 32; // h-8, needed for virtualizer estimateSize

export type ScrollableRowsProps<TData> = {
  table: Table<TData>;
  columns: GridColumn[];
  rowCount: number;
  activeCell: CellPosition | null;
  selection: GridSelection | null;
  editMode: EditMode;
  onCellMouseDown: (col: number, row: number, e: React.MouseEvent) => void;
  onCellMouseEnter: (col: number, row: number) => void;
  onCellDoubleClick: (col: number) => void;
  onGutterClick: (row: number, e: React.MouseEvent) => void;
  onCellChange: (rowIndex: number, columnId: string, value: unknown) => void;
  onEmptyAreaMouseDown: (e: React.MouseEvent) => void;
  stopEditing: () => void;
  startEditing: () => void;
  selectCells: (options?: {
    colIndex?: number;
    rowIndex?: number;
    extend?: boolean;
  }) => void;
  clearSelection: () => void;
  blurGrid: () => void;
  gutterColumn: boolean;
  rowActions?: RowAction[];
  readOnly: boolean;
  variant: DataGridVariant;
  cellHasWarning?: (rowIndex: number, columnId: string) => boolean;
};

export const ScrollableRows = forwardRef(function ScrollableRows<TData>(
  {
    table,
    columns,
    rowCount,
    activeCell,
    selection,
    editMode,
    onCellMouseDown,
    onCellMouseEnter,
    onCellDoubleClick,
    onGutterClick,
    onEmptyAreaMouseDown,
    onCellChange,
    stopEditing,
    startEditing,
    selectCells,
    clearSelection,
    blurGrid,
    gutterColumn,
    rowActions,
    readOnly,
    variant,
    cellHasWarning,
  }: ScrollableRowsProps<TData>,
  ref: React.ForwardedRef<RowsRef>,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [rowsHeight, setRowsHeight] = useState<number | undefined>(undefined);
  const [scrollState, setScrollState] = useState<ScrollState>({
    hasVerticalScroll: false,
    hasHorizontalScroll: false,
    scrollbarWidth: 0,
    scrollbarHeight: 0,
  });

  useLayoutEffect(function resizeRows() {
    const container = containerRef.current;
    if (!container) return;

    let lastHeight: number | undefined;
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height;
      if (lastHeight === undefined || height !== lastHeight) {
        lastHeight = height;
        setRowsHeight(height);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(function trackScrollState() {
    const el = scrollRef.current;
    if (!el) return;

    const update = () => {
      setScrollState({
        hasVerticalScroll: el.scrollHeight > el.clientHeight,
        hasHorizontalScroll: el.scrollWidth > el.clientWidth,
        scrollbarWidth: el.offsetWidth - el.clientWidth - 2,
        scrollbarHeight: el.offsetHeight - el.clientHeight - 2,
      });
    };

    update();
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, []);

  const visibleRowCount = rowsHeight ? Math.floor(rowsHeight / ROW_HEIGHT) : 10;
  const colCount = columns.length;

  const handleKeyDown = useRowsNavigation({
    activeCell,
    rowCount,
    colCount,
    editMode,
    selectCells,
    clearSelection,
    blurGrid,
    visibleRowCount,
  });

  useImperativeHandle(
    ref,
    () => ({
      handleKeyDown,
    }),
    [handleKeyDown],
  );

  useEffect(
    function scrollActiveCellIntoView() {
      const container = scrollRef.current;
      if (!activeCell || !container) return;

      const rowTop = (activeCell.row + 1) * ROW_HEIGHT;
      const rowBottom = (activeCell.row + 2) * ROW_HEIGHT;

      const visibleTop = container.scrollTop + ROW_HEIGHT;
      const visibleBottom = container.scrollTop + container.clientHeight;

      if (rowTop < visibleTop) {
        container.scrollTop = rowTop - ROW_HEIGHT;
      } else if (rowBottom > visibleBottom) {
        container.scrollTop = rowBottom - container.clientHeight;
      }

      const gutterWidth = gutterColumn ? 32 : 0;
      let colStart = gutterWidth;
      for (let i = 0; i < activeCell.col; i++) {
        colStart += columns[i]?.size ?? 100;
      }
      const colEnd = colStart + (columns[activeCell.col]?.size ?? 100);

      const scrollLeft = container.scrollLeft;
      const viewportWidth = container.clientWidth;

      if (colStart < scrollLeft + gutterWidth) {
        container.scrollLeft = colStart - gutterWidth;
      } else if (colEnd > scrollLeft + viewportWidth) {
        container.scrollLeft = colEnd - viewportWidth;
      }
    },
    [activeCell, gutterColumn, columns],
  );

  const rowVirtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const hasVerticalScroll = scrollState.hasVerticalScroll;

  const isReady = rowsHeight !== undefined;

  const gutterWidth = gutterColumn ? 32 : 0;
  const actionsWidth = rowActions ? 32 : 0;

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 datagrid-scroll-container"
      style={{ visibility: isReady ? "visible" : "hidden" }}
    >
      <div
        ref={scrollRef}
        onMouseDown={onEmptyAreaMouseDown}
        className="outline-none overflow-auto flex-1 border border-gray-200 h-full datagrid-scroll-area"
      >
        <div
          style={{
            height: totalSize,
            position: "relative",
          }}
        >
          {virtualRows.map((virtualRow) => {
            const rowsModel = table.getRowModel();
            const row = rowsModel.rows[virtualRow.index];
            const rowIndex = virtualRow.index;
            const isLast = virtualRow.index === rowsModel.rows.length - 1;

            return (
              <div
                key={row.id}
                role="row"
                aria-rowindex={rowIndex + 2}
                className="flex absolute w-full h-8"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                <GridRow
                  row={row}
                  rowIndex={rowIndex}
                  columns={columns}
                  activeCell={activeCell}
                  selection={selection}
                  editMode={editMode}
                  onCellMouseDown={onCellMouseDown}
                  onCellMouseEnter={onCellMouseEnter}
                  onCellDoubleClick={onCellDoubleClick}
                  onGutterClick={onGutterClick}
                  onCellChange={onCellChange}
                  stopEditing={stopEditing}
                  startEditing={startEditing}
                  gutterColumn={gutterColumn}
                  gutterIsLastRow={isLast && !hasVerticalScroll}
                  cellsIsLastRow={isLast && hasVerticalScroll}
                  rowActions={rowActions}
                  readOnly={readOnly}
                  variant={variant}
                  cellHasWarning={cellHasWarning}
                />
              </div>
            );
          })}
        </div>
      </div>

      {hasVerticalScroll && (
        <>
          <ScrollShadow
            position="top"
            topOffset={ROW_HEIGHT}
            startEdge={gutterWidth}
            endEdge={actionsWidth + scrollState.scrollbarWidth}
          />
          <ScrollShadow
            position="bottom"
            offset={scrollState.scrollbarHeight}
            startEdge={gutterWidth}
            endEdge={actionsWidth + scrollState.scrollbarWidth}
          />
        </>
      )}
      {scrollState.hasHorizontalScroll && (
        <>
          <ScrollShadow
            position="left"
            topOffset={ROW_HEIGHT}
            offset={gutterWidth}
            endEdge={scrollState.scrollbarHeight}
          />
          <ScrollShadow
            position="right"
            topOffset={ROW_HEIGHT}
            offset={actionsWidth + scrollState.scrollbarWidth}
            endEdge={scrollState.scrollbarHeight}
          />
        </>
      )}
    </div>
  );
}) as <TData>(
  props: ScrollableRowsProps<TData> & { ref?: React.Ref<RowsRef> },
) => React.ReactElement;

// --- Scroll state and shadows ---

type ScrollState = {
  hasVerticalScroll: boolean;
  hasHorizontalScroll: boolean;
  scrollbarWidth: number;
  scrollbarHeight: number;
};

function ScrollShadow({
  position,
  offset = 0,
  topOffset = 0,
  startEdge = 0,
  endEdge = 0,
}: {
  position: "top" | "bottom" | "left" | "right";
  offset?: number;
  topOffset?: number;
  startEdge?: number;
  endEdge?: number;
}) {
  const isHorizontal = position === "top" || position === "bottom";

  return (
    <div
      className="absolute pointer-events-none z-20 datagrid-scroll-shadow"
      data-position={position}
      style={{
        background: gradients[position],
        ...(isHorizontal
          ? { height: 10, left: startEdge, right: endEdge }
          : { width: 10, top: topOffset, bottom: endEdge }),
        ...(position === "top" && { top: topOffset }),
        ...(position === "bottom" && { bottom: offset }),
        ...(position === "left" && { left: offset }),
        ...(position === "right" && { right: offset }),
      }}
    />
  );
}

const gradients = {
  top: "radial-gradient(farthest-side at 50% 0, rgba(0, 0, 0, 0.12), transparent)",
  bottom:
    "radial-gradient(farthest-side at 50% 100%, rgba(0, 0, 0, 0.12), transparent)",
  left: "radial-gradient(farthest-side at 0 50%, rgba(0, 0, 0, 0.12), transparent)",
  right:
    "radial-gradient(farthest-side at 100% 50%, rgba(0, 0, 0, 0.12), transparent)",
};
