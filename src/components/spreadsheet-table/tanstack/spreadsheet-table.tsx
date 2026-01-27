import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
  Cell,
  Table,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import clsx from "clsx";
import { Button } from "src/components/elements";
import { AddIcon } from "src/icons";
import {
  SpreadsheetTableProps,
  SpreadsheetTableRef,
  SpreadsheetColumn,
  CellPosition,
  RowAction,
} from "./types";
import { useSelection } from "./use-selection";
import { useKeyboardNavigation } from "./use-keyboard-navigation";
import { useClipboard } from "./use-clipboard";
import { ActionsCell } from "./cells/actions-cell";

const ROW_HEIGHT = 32; // h-8, needed for virtualizer estimateSize

export const SpreadsheetTable = forwardRef(function SpreadsheetTable<
  TData extends Record<string, unknown>,
>(
  {
    data,
    columns,
    onChange,
    createRow,
    lockRows = false,
    emptyState,
    rowActions,
    addRowLabel,
    gutterColumn = false,
    onSelectionChange,
  }: SpreadsheetTableProps<TData>,
  ref: React.ForwardedRef<SpreadsheetTableRef>,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [gridHeight, setGridHeight] = useState<number | undefined>(undefined);
  const [scrollState, setScrollState] = useState({
    canScrollUp: false,
    canScrollDown: false,
  });

  const dataColumns = columns;
  const colCount = dataColumns.length;

  const {
    activeCell,
    selection,
    isEditing,
    isFullRowSelected,
    setActiveCell,
    setSelection,
    clearSelection,
    startEditing,
    stopEditing,
    moveActiveCell,
    moveToRowStart,
    moveToRowEnd,
    moveToGridStart,
    moveToGridEnd,
    moveByPage,
    selectRow,
    selectColumn,
    selectAll,
    isCellSelected,
    isCellActive,
    isDragging,
    startDrag,
    stopDrag,
  } = useSelection({
    rowCount: data.length,
    colCount,
    onSelectionChange,
  });

  const visibleRowCount = gridHeight ? Math.floor(gridHeight / ROW_HEIGHT) : 10;

  const blurGrid = useCallback(() => {
    scrollRef.current?.blur();
  }, []);

  const { handleKeyDown } = useKeyboardNavigation({
    activeCell,
    selection,
    isEditing,
    isFullRowSelected,
    columns: dataColumns,
    data,
    onChange,
    lockRows,
    moveActiveCell,
    moveToRowStart,
    moveToRowEnd,
    moveToGridStart,
    moveToGridEnd,
    moveByPage,
    setSelection,
    selectRow,
    selectColumn,
    selectAll,
    startEditing,
    stopEditing,
    clearSelection,
    blurGrid,
    visibleRowCount,
  });

  const wasEditingRef = useRef(false);
  useEffect(
    function refocusWhenEditingStops() {
      if (wasEditingRef.current && !isEditing && scrollRef.current) {
        scrollRef.current.focus();
      }
      wasEditingRef.current = isEditing;
    },
    [isEditing],
  );

  useEffect(
    function stopDragOnMouseUp() {
      if (!isDragging) return;

      const handleMouseUp = () => stopDrag();
      document.addEventListener("mouseup", handleMouseUp);
      return () => document.removeEventListener("mouseup", handleMouseUp);
    },
    [isDragging, stopDrag],
  );

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setScrollState({
      canScrollUp: el.scrollTop > 0,
      canScrollDown: el.scrollTop + el.clientHeight < el.scrollHeight - 1,
    });
  }, []);

  useEffect(
    function trackScrollState() {
      const el = scrollRef.current;
      if (!el) return;

      updateScrollState();
      el.addEventListener("scroll", updateScrollState);
      return () => el.removeEventListener("scroll", updateScrollState);
    },
    [updateScrollState],
  );

  useEffect(
    function updateScrollStateOnResize() {
      updateScrollState();
    },
    [data.length, gridHeight, updateScrollState],
  );

  const { handleCopy, handlePaste } = useClipboard({
    selection,
    columns: dataColumns,
    data,
    onChange,
  });

  useImperativeHandle(
    ref,
    () => ({
      setActiveCell: (cell: CellPosition) => setActiveCell(cell),
      setSelection,
      selection,
    }),
    [setActiveCell, setSelection, selection],
  );

  useLayoutEffect(
    function resizeVertically() {
      const container = containerRef.current;
      if (!container) return;

      let lastHeight: number | undefined;
      const BUTTON_SPACE = 38; // Button height (30px) + margin-top (8px)

      const observer = new ResizeObserver((entries) => {
        const containerHeight = entries[0]?.contentRect.height;
        if (lastHeight === undefined || containerHeight !== lastHeight) {
          lastHeight = containerHeight;
          const newGridHeight = addRowLabel
            ? Math.max(0, containerHeight - BUTTON_SPACE)
            : containerHeight;
          setGridHeight(newGridHeight);
        }
      });
      observer.observe(container);
      return () => observer.disconnect();
    },
    [addRowLabel],
  );

  // TanStack Table setup
  // Cast to ColumnDef[] because Partial<SpreadsheetColumnDef> breaks union type inference
  const table = useReactTable({
    data,
    columns: dataColumns as ColumnDef<TData, unknown>[],
    getCoreRowModel: getCoreRowModel(),
  });

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  useEffect(
    function scrollActiveCellIntoView() {
      if (!activeCell || !scrollRef.current) return;

      const container = scrollRef.current;

      // vertical scroll
      const rowTop = (activeCell.row + 1) * ROW_HEIGHT;
      const rowBottom = (activeCell.row + 2) * ROW_HEIGHT;

      const visibleTop = container.scrollTop + ROW_HEIGHT;
      const visibleBottom = container.scrollTop + container.clientHeight;

      if (rowTop < visibleTop) {
        container.scrollTop = rowTop - ROW_HEIGHT;
      } else if (rowBottom > visibleBottom) {
        container.scrollTop = rowBottom - container.clientHeight;
      }

      // horixontal scroll
      const gutterWidth = gutterColumn ? 40 : 0; // w-10 = 40px
      let colStart = gutterWidth;
      for (let i = 0; i < activeCell.col; i++) {
        colStart += dataColumns[i]?.size ?? 100;
      }
      const colEnd = colStart + (dataColumns[activeCell.col]?.size ?? 100);

      const scrollLeft = container.scrollLeft;
      const viewportWidth = container.clientWidth;

      if (colStart < scrollLeft + gutterWidth) {
        container.scrollLeft = colStart - gutterWidth;
      } else if (colEnd > scrollLeft + viewportWidth) {
        container.scrollLeft = colEnd - viewportWidth;
      }
    },
    [activeCell, gutterColumn, dataColumns],
  );

  const firstEditableCol = dataColumns.findIndex((col) => !col.disabled);

  const focusRow = useCallback(
    (rowIndex: number) => {
      if (dataColumns.length === 0) return;
      const col = firstEditableCol !== -1 ? firstEditableCol : 0;
      setActiveCell({ col, row: rowIndex });
      scrollRef.current?.focus();
    },
    [dataColumns.length, firstEditableCol, setActiveCell],
  );

  const handleAddRow = useCallback(() => {
    const newRow = createRow();
    onChange([...data, newRow]);
    focusRow(data.length);
  }, [createRow, data, onChange, focusRow]);

  const handleCellMouseDown = useCallback(
    (col: number, row: number, e: React.MouseEvent) => {
      if (e.button !== 0) return; // Only left click
      setActiveCell({ col, row }, e.shiftKey);
      if (!e.shiftKey) {
        startDrag();
      }
    },
    [setActiveCell, startDrag],
  );

  const handleCellMouseEnter = useCallback(
    (col: number, row: number) => {
      if (isDragging) {
        setActiveCell({ col, row }, true);
      }
    },
    [isDragging, setActiveCell],
  );

  const handleCellDoubleClick = useCallback(
    (col: number) => {
      const column = dataColumns[col] as SpreadsheetColumn | undefined;
      if (!column?.disabled && !column?.disableKeys) {
        startEditing();
      }
    },
    [dataColumns, startEditing],
  );

  const handleGutterClick = useCallback(
    (row: number, e: React.MouseEvent) => {
      selectRow(row, e.shiftKey);
    },
    [selectRow],
  );

  const handleCellChange = useCallback(
    (rowIndex: number, columnId: string, value: unknown) => {
      const newData = data.map((row, idx) => {
        if (idx === rowIndex) {
          return { ...row, [columnId]: value };
        }
        return row;
      });
      onChange(newData);
    },
    [data, onChange],
  );

  const handleFocus = useCallback(() => {
    if (activeCell || data.length === 0) return;
    focusRow(0);
  }, [activeCell, data.length, focusRow]);

  if (data.length === 0 && emptyState) {
    return emptyState as React.ReactElement;
  }

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const isReady = gridHeight !== undefined;

  return (
    <div ref={containerRef} className="flex flex-col justify-between h-full">
      <div
        className="relative"
        style={{
          height: gridHeight,
          visibility: isReady ? "visible" : "hidden",
        }}
      >
        <div
          ref={scrollRef}
          role="grid"
          aria-rowcount={data.length}
          aria-colcount={colCount}
          aria-multiselectable="true"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onCopy={handleCopy}
          onPaste={handlePaste}
          className="outline-none overflow-auto h-full border border-gray-200"
          data-capture-escape-key
        >
          <TableHeader
            table={table}
            showGutterColumn={gutterColumn}
            showActionsColumn={!!rowActions}
            onSelectColumn={selectColumn}
            onSelectAll={selectAll}
          />

          <div
            style={{
              height: totalSize,
              position: "relative",
            }}
          >
            {virtualRows.map((virtualRow) => {
              const row = table.getRowModel().rows[virtualRow.index];
              const rowIndex = virtualRow.index;

              return (
                <div
                  key={row.id}
                  role="row"
                  aria-rowindex={rowIndex + 2}
                  className="flex absolute w-full h-8"
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  {gutterColumn && (
                    <TableGutterCell
                      rowIndex={rowIndex}
                      onClick={(e) => handleGutterClick(rowIndex, e)}
                    />
                  )}

                  {row.getVisibleCells().map((cell, colIndex) => {
                    const column = dataColumns[colIndex];
                    const accessorKey = column.accessorKey;
                    const cellSelected = isCellSelected(colIndex, rowIndex);

                    return (
                      <TableDataCell
                        key={cell.id}
                        cell={cell}
                        colIndex={colIndex}
                        rowIndex={rowIndex}
                        isSelected={cellSelected}
                        isActive={isCellActive(colIndex, rowIndex)}
                        isEditing={isEditing}
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
                          handleCellMouseDown(colIndex, rowIndex, e)
                        }
                        onMouseEnter={() =>
                          handleCellMouseEnter(colIndex, rowIndex)
                        }
                        onDoubleClick={() => handleCellDoubleClick(colIndex)}
                        onBlur={stopEditing}
                        onChange={
                          accessorKey
                            ? (value) =>
                                handleCellChange(rowIndex, accessorKey, value)
                            : undefined
                        }
                        CellComponent={column.cellComponent}
                      />
                    );
                  })}

                  <TableActionsCell
                    rowActions={rowActions}
                    rowIndex={rowIndex}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <ScrollShadow position="top" visible={scrollState.canScrollUp} />
        <ScrollShadow position="bottom" visible={scrollState.canScrollDown} />
      </div>

      {addRowLabel && (
        <Button
          variant="default"
          size="sm"
          onClick={handleAddRow}
          className="w-full justify-center mt-2"
        >
          <AddIcon size="sm" />
          {addRowLabel}
        </Button>
      )}
    </div>
  );
}) as <TData extends Record<string, unknown>>(
  props: SpreadsheetTableProps<TData> & {
    ref?: React.Ref<SpreadsheetTableRef>;
  },
) => React.ReactElement;

function TableHeader<T>({
  showGutterColumn,
  showActionsColumn,
  table,
  onSelectColumn,
  onSelectAll,
}: {
  showGutterColumn: boolean;
  showActionsColumn: boolean;
  table: Table<T>;
  onSelectColumn: (colIndex: number) => void;
  onSelectAll: () => void;
}) {
  return (
    <div
      role="row"
      className="flex sticky top-0 z-10 bg-gray-100 border-b border-gray-20 -mb-1"
    >
      {showGutterColumn && (
        <div
          role="columnheader"
          className="flex items-center justify-center font-semibold text-sm shrink-0 cursor-pointer select-none w-10 h-8 text-gray-600 bg-gray-100"
          onClick={onSelectAll}
        />
      )}
      {table.getHeaderGroups().map((headerGroup) =>
        headerGroup.headers.map((header, colIndex) => (
          <div
            key={header.id}
            role="columnheader"
            className="flex items-center px-2 font-semibold text-sm truncate cursor-pointer select-none h-8 grow text-gray-600 bg-gray-100"
            style={{
              width: header.getSize(),
              minWidth: header.getSize(),
            }}
            onClick={() => onSelectColumn(colIndex)}
          >
            {flexRender(header.column.columnDef.header, header.getContext())}
          </div>
        )),
      )}
      {showActionsColumn && (
        <div
          role="columnheader"
          className="shrink-0 sticky right-0 w-8 h-8 z-10 bg-gray-100"
        />
      )}
    </div>
  );
}

function TableGutterCell({
  rowIndex,
  onClick,
}: {
  rowIndex: number;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      role="rowheader"
      className="flex items-center justify-center text-xs shrink-0 cursor-pointer select-none w-10 h-8 bg-gray-100 text-gray-600"
      onClick={onClick}
    >
      {rowIndex + 1}
    </div>
  );
}

type SelectionEdge = {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
};

function TableDataCell<T>({
  cell,
  colIndex,
  rowIndex,
  isSelected,
  isActive,
  isEditing,
  selectionEdge,
  onMouseDown,
  onMouseEnter,
  onDoubleClick,
  onBlur,
  onChange,
  CellComponent,
}: {
  cell: Cell<T, unknown>;
  colIndex: number;
  rowIndex: number;
  isSelected: boolean;
  isActive: boolean;
  isEditing: boolean;
  selectionEdge?: SelectionEdge;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onDoubleClick: () => void;
  onChange?: (value: unknown) => void;
  onBlur: () => void;
  CellComponent: SpreadsheetColumn["cellComponent"];
}) {
  return (
    <div
      key={cell.id}
      role="gridcell"
      aria-colindex={colIndex + 1}
      aria-selected={isSelected}
      className={clsx(
        "relative h-8 grow select-none",
        "border-t border-l border-gray-200",
        isActive ? "bg-white" : isSelected ? "bg-purple-300/10" : "bg-white",
        selectionEdge?.top && "border-t-purple-500",
        selectionEdge?.left && "border-l-purple-500",
        selectionEdge?.bottom && "border-b border-b-purple-500",
        selectionEdge?.right && "border-r border-r-purple-500",
        selectionEdge && "z-[1]",
      )}
      style={{
        width: cell.column.getSize(),
        minWidth: cell.column.getSize(),
      }}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onDoubleClick={onDoubleClick}
    >
      {CellComponent ? (
        <CellComponent
          value={cell.getValue()}
          rowIndex={rowIndex}
          columnIndex={colIndex}
          isActive={isActive}
          isEditing={isActive && isEditing}
          isSelected={isSelected}
          onChange={(newValue) => onChange?.(newValue)}
          stopEditing={onBlur}
          focus={isActive}
        />
      ) : (
        <div className="w-full h-full flex items-center px-2 text-sm">
          {String(cell.getValue() ?? "")}
        </div>
      )}
    </div>
  );
}

function TableActionsCell({
  rowIndex,
  rowActions,
}: {
  rowIndex: number;
  rowActions?: RowAction[];
}) {
  return rowActions ? (
    <div
      role="gridcell"
      className="sticky right-0 shrink-0 border-t border-l border-gray-200 w-8 h-8 bg-white z-10"
    >
      <ActionsCell rowIndex={rowIndex} actions={rowActions} />
    </div>
  ) : null;
}

function ScrollShadow({
  position,
  visible,
}: {
  position: "top" | "bottom";
  visible: boolean;
}) {
  if (!visible) return null;

  const isTop = position === "top";
  return (
    <div
      className={clsx(
        "absolute left-0 right-0 h-2.5 pointer-events-none z-20",
        isTop ? "top-8" : "bottom-0",
      )}
      style={{
        background: isTop
          ? "radial-gradient(farthest-side at 50% 0, rgba(0, 0, 0, 0.12), transparent)"
          : "radial-gradient(farthest-side at 50% 100%, rgba(0, 0, 0, 0.12), transparent)",
      }}
    />
  );
}
