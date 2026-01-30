import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { useReactTable, getCoreRowModel } from "@tanstack/react-table";
import {
  DataGridRef,
  DataGridVariant,
  GridColumn,
  CellPosition,
  RowAction,
  GridSelection,
} from "./types";
import { useSelection, useGridEditing, useClipboard } from "./hooks";
import {
  GridHeader,
  Rows,
  RowsRef,
  ScrollableRows,
  AddRowButton,
} from "./shared";

type DataGridProps<TData extends Record<string, unknown>> = {
  data: TData[];
  columns: GridColumn[];
  onChange: (data: TData[]) => void;
  createRow: () => TData;
  lockRows?: boolean;
  emptyState?: React.ReactNode;
  rowActions?: RowAction[];
  addRowLabel?: string;
  gutterColumn?: boolean;
  onSelectionChange?: (selection: GridSelection | null) => void;
  variant?: DataGridVariant;
};

export const DataGrid = forwardRef(function DataGrid<
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
    variant = "spreadsheet",
  }: DataGridProps<TData>,
  ref: React.ForwardedRef<DataGridRef>,
) {
  const gridRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<RowsRef>(null);

  const colCount = columns.length;

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

  const blurGrid = useCallback(() => {
    gridRef.current?.blur();
  }, []);

  const handleEditingKeyDown = useGridEditing({
    activeCell,
    selection,
    isEditing,
    isFullRowSelected,
    columns,
    data,
    onChange,
    lockRows,
    colCount,
    moveActiveCell,
    setSelection,
    startEditing,
    stopEditing,
    clearSelection,
    blurGrid,
  });

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      rowsRef.current?.handleKeyDown(e);
      if (!e.defaultPrevented) {
        handleEditingKeyDown(e);
      }
    },
    [handleEditingKeyDown],
  );

  const wasEditingRef = useRef(false);
  useEffect(
    function refocusWhenEditingStops() {
      if (wasEditingRef.current && !isEditing) {
        gridRef.current?.focus();
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

  const { handleCopy, handlePaste } = useClipboard({
    selection,
    columns,
    data,
    onChange,
    createRow,
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

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const firstEditableCol = columns.findIndex((col) => !col.disabled);

  const focusRow = useCallback(
    (rowIndex: number) => {
      if (columns.length === 0) return;
      const col = firstEditableCol !== -1 ? firstEditableCol : 0;
      gridRef.current?.focus();
      setActiveCell({ col, row: rowIndex });
    },
    [columns.length, firstEditableCol, setActiveCell],
  );

  const handleAddRow = useCallback(() => {
    const newRow = createRow();
    onChange([...data, newRow]);
    focusRow(data.length);
  }, [createRow, data, onChange, focusRow]);

  const handleCellMouseDown = useCallback(
    (col: number, row: number, e: React.MouseEvent) => {
      if (e.button !== 0) return;
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
      const column = columns[col] as GridColumn | undefined;
      if (!column?.disabled && !column?.disableKeys) {
        startEditing();
      }
    },
    [columns, startEditing],
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

  const handleEmptyAreaMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        clearSelection();
      }
    },
    [clearSelection],
  );

  if (data.length === 0 && emptyState) {
    return emptyState as React.ReactElement;
  }

  const isSpreadsheet = variant === "spreadsheet";

  const rowsProps = {
    table,
    columns,
    selection,
    isEditing,
    isCellSelected,
    isCellActive,
    onCellMouseDown: handleCellMouseDown,
    onCellMouseEnter: handleCellMouseEnter,
    onCellDoubleClick: handleCellDoubleClick,
    onGutterClick: handleGutterClick,
    onCellChange: handleCellChange,
    stopEditing,
    gutterColumn,
    rowActions,
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
  };

  return (
    <div className={isSpreadsheet ? "flex flex-col h-full" : "flex flex-col"}>
      <div
        ref={gridRef}
        role="grid"
        aria-rowcount={data.length}
        aria-colcount={colCount}
        aria-multiselectable={true}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onCopy={handleCopy}
        onPaste={handlePaste}
        className={
          isSpreadsheet
            ? "relative flex flex-col flex-1 min-h-0 outline-none"
            : "relative flex flex-col outline-none"
        }
        data-capture-escape-key
      >
        <GridHeader
          table={table}
          showGutterColumn={gutterColumn}
          showActionsColumn={!!rowActions}
          onSelectColumn={selectColumn}
          onSelectAll={selectAll}
          variant={variant}
        />

        {isSpreadsheet ? (
          <ScrollableRows
            ref={rowsRef}
            {...rowsProps}
            onEmptyAreaMouseDown={handleEmptyAreaMouseDown}
          />
        ) : (
          <Rows ref={rowsRef} {...rowsProps} />
        )}
      </div>

      <AddRowButton
        label={addRowLabel}
        onClick={handleAddRow}
        variant={variant}
      />
    </div>
  );
}) as <TData extends Record<string, unknown>>(
  props: DataGridProps<TData> & {
    ref?: React.Ref<DataGridRef>;
  },
) => React.ReactElement;
