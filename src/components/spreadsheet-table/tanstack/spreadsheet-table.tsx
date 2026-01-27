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

  const dataColumns = columns;
  const colCount = dataColumns.length;

  const {
    activeCell,
    selection,
    isEditing,
    isFullRowSelected,
    setActiveCell,
    setSelection,
    startEditing,
    stopEditing,
    moveActiveCell,
    selectRow,
    isCellSelected,
    isCellActive,
  } = useSelection({
    rowCount: data.length,
    colCount,
    onSelectionChange,
  });

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
    setActiveCell,
    startEditing,
    stopEditing,
  });

  useEffect(
    function refocusWhenEditingStops() {
      if (!isEditing && scrollRef.current) {
        scrollRef.current.focus();
      }
    },
    [isEditing],
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

  const handleAddRow = useCallback(() => {
    const newRow = createRow();
    onChange([...data, newRow]);
  }, [createRow, data, onChange]);

  const handleCellClick = useCallback(
    (col: number, row: number, e: React.MouseEvent) => {
      setActiveCell({ col, row }, e.shiftKey);
    },
    [setActiveCell],
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

  if (data.length === 0 && emptyState) {
    return emptyState as React.ReactElement;
  }

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  return (
    <div ref={containerRef} className="flex flex-col justify-between h-full">
      <div
        ref={scrollRef}
        role="grid"
        aria-rowcount={data.length}
        aria-colcount={colCount}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onCopy={handleCopy}
        onPaste={handlePaste}
        className="outline-none overflow-auto relative border border-gray-200"
        style={{ height: gridHeight }}
      >
        <TableHeader
          table={table}
          showGutterColumn={gutterColumn}
          showActionsColumn={!!rowActions}
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

                  return (
                    <TableDataCell
                      key={cell.id}
                      cell={cell}
                      colIndex={colIndex}
                      rowIndex={rowIndex}
                      isSelected={isCellSelected(colIndex, rowIndex)}
                      isActive={isCellActive(colIndex, rowIndex)}
                      isEditing={isEditing}
                      onClick={(e) => handleCellClick(colIndex, rowIndex, e)}
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

                <TableActionsCell rowActions={rowActions} rowIndex={rowIndex} />
              </div>
            );
          })}
        </div>
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
}: {
  showGutterColumn: boolean;
  showActionsColumn: boolean;
  table: Table<T>;
}) {
  return (
    <div role="row" className="flex sticky top-0 z-10 bg-gray-100">
      {showGutterColumn && (
        <div
          role="columnheader"
          className="flex items-center justify-center font-semibold text-sm shrink-0 w-10 h-8 text-gray-600 bg-gray-100"
        />
      )}
      {table.getHeaderGroups().map((headerGroup) =>
        headerGroup.headers.map((header) => (
          <div
            key={header.id}
            role="columnheader"
            className="flex items-center px-2 font-semibold text-sm truncate h-8 grow text-gray-600 bg-gray-100"
            style={{
              width: header.getSize(),
              minWidth: header.getSize(),
            }}
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

function TableDataCell<T>({
  cell,
  colIndex,
  rowIndex,
  isSelected,
  isActive,
  isEditing,
  onClick,
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
  onClick: (e: React.MouseEvent) => void;
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
        "relative border-t border-l border-gray-200 h-8 grow",
        isSelected ? "bg-purple-300/10" : "bg-white",
        isActive &&
          "outline outline-1 -outline-offset-1 outline-purple-500 z-[1]",
      )}
      style={{
        width: cell.column.getSize(),
        minWidth: cell.column.getSize(),
      }}
      onClick={onClick}
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
