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
import clsx from "clsx";
import {
  CellPosition,
  DataGridVariant,
  GridColumn,
  GridSelection,
  RowAction,
} from "../types";
import { useRowsNavigation } from "../hooks";
import { GridDataCell } from "./grid-data-cell";
import { RowGutterCell } from "./row-gutter-cell";
import { RowActionsCell } from "./row-actions-cell";
import { RowsRef } from "./rows";

export const ROW_HEIGHT = 32; // h-8, needed for virtualizer estimateSize

type ScrollableRowsProps<TData> = {
  table: Table<TData>;
  columns: GridColumn[];
  selection: GridSelection | null;
  isEditing: boolean;
  isCellSelected: (col: number, row: number) => boolean;
  isCellActive: (col: number, row: number) => boolean;
  onCellMouseDown: (col: number, row: number, e: React.MouseEvent) => void;
  onCellMouseEnter: (col: number, row: number) => void;
  onCellDoubleClick: (col: number) => void;
  onGutterClick: (row: number, e: React.MouseEvent) => void;
  onCellChange: (rowIndex: number, columnId: string, value: unknown) => void;
  stopEditing: () => void;
  startEditing: () => void;
  onEmptyAreaMouseDown: (e: React.MouseEvent) => void;
  gutterColumn: boolean;
  rowActions?: RowAction[];
  readOnly: boolean;
  variant: DataGridVariant;
  // Navigation props
  activeCell: CellPosition | null;
  moveActiveCell: (
    direction: "up" | "down" | "left" | "right",
    extend?: boolean,
  ) => void;
  moveToRowStart: (extend?: boolean) => void;
  moveToRowEnd: (extend?: boolean) => void;
  moveToGridStart: (extend?: boolean) => void;
  moveToGridEnd: (extend?: boolean) => void;
  moveByPage: (
    direction: "up" | "down",
    pageSize: number,
    extend?: boolean,
  ) => void;
  selectRow: (rowIndex: number, extend?: boolean) => void;
  selectColumn: (colIndex: number) => void;
  selectAll: () => void;
  clearSelection: () => void;
  blurGrid: () => void;
};

export const ScrollableRows = forwardRef(function ScrollableRows<TData>(
  {
    table,
    columns,
    selection,
    isEditing,
    isCellSelected,
    isCellActive,
    onCellMouseDown,
    onCellMouseEnter,
    onCellDoubleClick,
    onGutterClick,
    onCellChange,
    stopEditing,
    startEditing,
    onEmptyAreaMouseDown,
    gutterColumn,
    rowActions,
    readOnly,
    variant,
    activeCell,
    moveActiveCell,
    moveToRowStart,
    moveToRowEnd,
    moveToGridStart,
    moveToGridEnd,
    moveByPage,
    selectRow,
    selectColumn,
    selectAll,
    clearSelection,
    blurGrid,
  }: ScrollableRowsProps<TData>,
  ref: React.ForwardedRef<RowsRef>,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [rowsHeight, setRowsHeight] = useState<number | undefined>(undefined);
  const [scrollState, setScrollState] = useState<ScrollState>({
    canScrollUp: false,
    canScrollDown: false,
    canScrollLeft: false,
    canScrollRight: false,
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
    const updateScrollState = () => {
      const el = scrollRef.current;
      if (!el) return;
      setScrollState({
        canScrollUp: el.scrollTop > 0,
        canScrollDown: el.scrollTop + el.clientHeight < el.scrollHeight - 1,
        canScrollLeft: el.scrollLeft > 0,
        canScrollRight: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
        scrollbarWidth: el.offsetWidth - el.clientWidth,
        scrollbarHeight: el.offsetHeight - el.clientHeight,
      });
    };

    const el = scrollRef.current;
    if (!el) return;

    updateScrollState();
    el.addEventListener("scroll", updateScrollState);

    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener("scroll", updateScrollState);
      resizeObserver.disconnect();
    };
  }, []);

  const visibleRowCount = rowsHeight ? Math.floor(rowsHeight / ROW_HEIGHT) : 10;
  const colCount = columns.length;
  const isInteractive =
    selection !== null &&
    selection.min.col === selection.max.col &&
    selection.min.row === selection.max.row;

  const handleKeyDown = useRowsNavigation({
    activeCell,
    colCount,
    isEditing,
    moveActiveCell,
    moveToRowStart,
    moveToRowEnd,
    moveToGridStart,
    moveToGridEnd,
    moveByPage,
    selectRow,
    selectColumn,
    selectAll,
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

      const gutterWidth = gutterColumn ? 40 : 0;
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
  const hasVerticalScroll =
    scrollState.canScrollUp || scrollState.canScrollDown;

  const isReady = rowsHeight !== undefined;

  const gutterWidth = gutterColumn ? (variant === "spreadsheet" ? 40 : 32) : 0;
  const actionsWidth = rowActions ? 32 : 0;

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0"
      style={{ visibility: isReady ? "visible" : "hidden" }}
    >
      <div
        ref={scrollRef}
        onMouseDown={onEmptyAreaMouseDown}
        className={clsx(
          "outline-none overflow-auto flex-1 border border-gray-200 h-full",
        )}
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
                {gutterColumn && (
                  <RowGutterCell
                    rowIndex={rowIndex}
                    onClick={(e) => onGutterClick(rowIndex, e)}
                    variant={variant}
                    isLastRow={isLast && !hasVerticalScroll}
                  />
                )}

                {row.getVisibleCells().map((cell, colIndex) => {
                  const column = columns[colIndex];
                  const accessorKey = column.accessorKey;
                  const cellSelected = isCellSelected(colIndex, rowIndex);

                  return (
                    <GridDataCell
                      key={cell.id}
                      cell={cell}
                      colIndex={colIndex}
                      rowIndex={rowIndex}
                      isSelected={cellSelected}
                      isActive={isCellActive(colIndex, rowIndex)}
                      isEditing={isEditing}
                      isInteractive={isInteractive}
                      readOnly={readOnly || !!column.disabled}
                      selectionEdge={
                        cellSelected && selection
                          ? {
                              top: rowIndex === selection.min.row,
                              bottom: rowIndex === selection.max.row,
                              left: colIndex === selection.min.col,
                              right: colIndex === selection.max.col,
                            }
                          : undefined
                      }
                      onMouseDown={(e) =>
                        onCellMouseDown(colIndex, rowIndex, e)
                      }
                      onMouseEnter={() => onCellMouseEnter(colIndex, rowIndex)}
                      onDoubleClick={() => onCellDoubleClick(colIndex)}
                      onBlur={stopEditing}
                      onStartEditing={startEditing}
                      onChange={
                        accessorKey
                          ? (value) =>
                              onCellChange(rowIndex, accessorKey, value)
                          : undefined
                      }
                      CellComponent={column.cellComponent}
                      variant={variant}
                      isLastRow={isLast && hasVerticalScroll}
                    />
                  );
                })}

                <RowActionsCell
                  rowActions={rowActions}
                  rowIndex={rowIndex}
                  variant={variant}
                  isLastRow={isLast && hasVerticalScroll}
                  disabled={readOnly}
                />
              </div>
            );
          })}
        </div>
      </div>

      <ScrollShadow
        position="top"
        visible={scrollState.canScrollUp}
        topOffset={ROW_HEIGHT}
        startEdge={gutterWidth}
        endEdge={actionsWidth + scrollState.scrollbarWidth}
      />
      <ScrollShadow
        position="bottom"
        visible={scrollState.canScrollDown}
        offset={scrollState.scrollbarHeight}
        startEdge={gutterWidth}
        endEdge={actionsWidth + scrollState.scrollbarWidth}
      />
      <ScrollShadow
        position="left"
        visible={scrollState.canScrollLeft}
        topOffset={ROW_HEIGHT}
        offset={gutterWidth}
        endEdge={scrollState.scrollbarHeight}
      />
      <ScrollShadow
        position="right"
        visible={scrollState.canScrollRight}
        topOffset={ROW_HEIGHT}
        offset={actionsWidth + scrollState.scrollbarWidth}
        endEdge={scrollState.scrollbarHeight}
      />
    </div>
  );
}) as <TData>(
  props: ScrollableRowsProps<TData> & { ref?: React.Ref<RowsRef> },
) => React.ReactElement;

// --- Scroll state and shadows ---

type ScrollState = {
  canScrollUp: boolean;
  canScrollDown: boolean;
  canScrollLeft: boolean;
  canScrollRight: boolean;
  scrollbarWidth: number;
  scrollbarHeight: number;
};

function ScrollShadow({
  position,
  visible,
  offset = 0,
  topOffset = 0,
  startEdge = 0,
  endEdge = 0,
}: {
  position: "top" | "bottom" | "left" | "right";
  visible: boolean;
  offset?: number;
  topOffset?: number;
  startEdge?: number;
  endEdge?: number;
}) {
  if (!visible) return null;

  const isHorizontal = position === "top" || position === "bottom";

  return (
    <div
      className="absolute pointer-events-none z-20"
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
