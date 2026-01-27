import {
  forwardRef,
  useCallback,
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
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { colors } from "src/lib/constants";
import { Button } from "src/components/elements";
import { AddIcon } from "src/icons";
import {
  SpreadsheetTableProps,
  SpreadsheetTableRef,
  SpreadsheetColumn,
  CellPosition,
} from "./types";
import { useSelection } from "./use-selection";
import { useKeyboardNavigation } from "./use-keyboard-navigation";
import { useClipboard } from "./use-clipboard";
import { ActionsCell } from "./cells/actions-cell";

const ROW_HEIGHT = 32;
const GUTTER_WIDTH = 40;
const ACTIONS_WIDTH = 40;

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

  // Filter out gutter/action columns for data column count
  const dataColumns = columns;
  const colCount = dataColumns.length;

  // Selection state
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

  // Keyboard navigation
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

  // Clipboard
  const { handleCopy, handlePaste } = useClipboard({
    selection,
    columns: dataColumns,
    data,
    onChange,
  });

  // Expose ref methods
  useImperativeHandle(
    ref,
    () => ({
      setActiveCell: (cell: CellPosition) => setActiveCell(cell),
      setSelection,
      selection,
    }),
    [setActiveCell, setSelection, selection],
  );

  // Vertical auto-sizing
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

  // Virtualization
  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  // Add row handler
  const handleAddRow = useCallback(() => {
    const newRow = createRow();
    onChange([...data, newRow]);
  }, [createRow, data, onChange]);

  // Cell click handler
  const handleCellClick = useCallback(
    (col: number, row: number, e: React.MouseEvent) => {
      setActiveCell({ col, row }, e.shiftKey);
    },
    [setActiveCell],
  );

  // Cell double click handler (start editing)
  const handleCellDoubleClick = useCallback(
    (col: number) => {
      const column = dataColumns[col] as SpreadsheetColumn | undefined;
      if (!column?.disabled && !column?.disableKeys) {
        startEditing();
      }
    },
    [dataColumns, startEditing],
  );

  // Gutter click handler
  const handleGutterClick = useCallback(
    (row: number, e: React.MouseEvent) => {
      selectRow(row, e.shiftKey);
    },
    [selectRow],
  );

  // Cell value change handler
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

  // Empty state
  if (data.length === 0 && emptyState) {
    return emptyState as React.ReactElement;
  }

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  return (
    <div ref={containerRef} className="flex flex-col justify-between h-full">
      <div
        ref={scrollRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onCopy={handleCopy}
        onPaste={handlePaste}
        className="outline-none overflow-auto relative"
        style={{
          height: gridHeight,
          ["--spreadsheet-selection-border-color" as string]: colors.purple500,
          ["--spreadsheet-selection-bg" as string]: `${colors.purple300}1a`,
          ["--spreadsheet-header-bg" as string]: colors.gray100,
          ["--spreadsheet-header-text" as string]: colors.gray600,
        }}
      >
        {/* Header row */}
        <div
          className="flex sticky top-0 z-10"
          style={{ backgroundColor: "var(--spreadsheet-header-bg)" }}
        >
          {gutterColumn && (
            <div
              className="flex items-center justify-center font-semibold text-sm shrink-0"
              style={{
                width: GUTTER_WIDTH,
                height: ROW_HEIGHT,
                color: "var(--spreadsheet-header-text)",
                backgroundColor: "var(--spreadsheet-header-bg)",
              }}
            />
          )}
          {table.getHeaderGroups().map((headerGroup) =>
            headerGroup.headers.map((header) => (
              <div
                key={header.id}
                className="flex items-center px-2 font-semibold text-sm truncate"
                style={{
                  width: header.getSize(),
                  minWidth: header.getSize(),
                  height: ROW_HEIGHT,
                  color: "var(--spreadsheet-header-text)",
                  backgroundColor: "var(--spreadsheet-header-bg)",
                  flexGrow: 1,
                }}
              >
                {flexRender(
                  header.column.columnDef.header,
                  header.getContext(),
                )}
              </div>
            )),
          )}
          {rowActions && (
            <div
              className="shrink-0 sticky right-0"
              style={{
                width: ACTIONS_WIDTH,
                height: ROW_HEIGHT,
                backgroundColor: "var(--spreadsheet-header-bg)",
              }}
            />
          )}
        </div>

        {/* Virtual rows container */}
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
                className="flex absolute w-full"
                style={{
                  height: ROW_HEIGHT,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {/* Gutter column */}
                {gutterColumn && (
                  <div
                    className="flex items-center justify-center text-xs shrink-0 cursor-pointer select-none"
                    style={{
                      width: GUTTER_WIDTH,
                      height: ROW_HEIGHT,
                      backgroundColor: "var(--spreadsheet-header-bg)",
                      color: "var(--spreadsheet-header-text)",
                    }}
                    onClick={(e) => handleGutterClick(rowIndex, e)}
                  >
                    {rowIndex + 1}
                  </div>
                )}

                {/* Data cells */}
                {row.getVisibleCells().map((cell, colIndex) => {
                  const column = dataColumns[colIndex];
                  const isActive = isCellActive(colIndex, rowIndex);
                  const isSelected = isCellSelected(colIndex, rowIndex);
                  const CellComponent = column.cellComponent;
                  const accessorKey = column.accessorKey;

                  return (
                    <div
                      key={cell.id}
                      className="relative border-b border-r border-gray-200"
                      style={{
                        width: cell.column.getSize(),
                        minWidth: cell.column.getSize(),
                        height: ROW_HEIGHT,
                        flexGrow: 1,
                        backgroundColor: isSelected
                          ? "var(--spreadsheet-selection-bg)"
                          : "white",
                        outline: isActive
                          ? `2px solid var(--spreadsheet-selection-border-color)`
                          : "none",
                        outlineOffset: "-2px",
                        zIndex: isActive ? 1 : 0,
                      }}
                      onClick={(e) => handleCellClick(colIndex, rowIndex, e)}
                      onDoubleClick={() => handleCellDoubleClick(colIndex)}
                    >
                      {CellComponent ? (
                        <CellComponent
                          value={cell.getValue()}
                          rowIndex={rowIndex}
                          columnIndex={colIndex}
                          isActive={isActive}
                          isEditing={isActive && isEditing}
                          isSelected={isSelected}
                          onChange={(newValue) =>
                            accessorKey &&
                            handleCellChange(rowIndex, accessorKey, newValue)
                          }
                          stopEditing={stopEditing}
                          focus={isActive}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center px-2 text-sm">
                          {String(cell.getValue() ?? "")}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Actions column */}
                {rowActions && (
                  <div
                    className="sticky right-0 shrink-0 border-b border-gray-200"
                    style={{
                      width: ACTIONS_WIDTH,
                      height: ROW_HEIGHT,
                      backgroundColor: "white",
                    }}
                  >
                    <ActionsCell rowIndex={rowIndex} actions={rowActions} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add row button */}
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
