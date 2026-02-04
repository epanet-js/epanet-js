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
  RowAction,
  GridSelection,
} from "./types";
import {
  useSelection,
  useGridEditing,
  useClipboard,
  useEditMode,
  useMouseSelection,
} from "./hooks";
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
  readOnly?: boolean;
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
    readOnly = false,
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

  const { editMode, startEditing, stopEditing } = useEditMode();

  const { activeCell, selection, clearSelection, selectCells } = useSelection({
    rowCount: data.length,
    colCount: columns.length,
    stopEditing,
    onSelectionChange,
  });

  const { handleCellMouseDown, handleCellMouseEnter } = useMouseSelection({
    editMode,
    selectCells,
  });

  const blurGrid = useCallback(() => {
    gridRef.current?.blur();
  }, []);

  const handleEditingKeyDown = useGridEditing({
    activeCell,
    selection,
    editMode,
    columns,
    data,
    onChange,
    readOnly,
    rowCount: data.length,
    colCount: columns.length,
    selectCells,
    startEditing,
    stopEditing,
    clearSelection,
    blurGrid,
  });

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const wasPreventedBefore = e.defaultPrevented;
      rowsRef.current?.handleKeyDown(e);
      if (wasPreventedBefore || !e.defaultPrevented) {
        handleEditingKeyDown(e);
      }
    },
    [handleEditingKeyDown],
  );

  const wasEditingRef = useRef(false);

  useEffect(
    function refocusWhenEditingStops() {
      if (wasEditingRef.current && !editMode) {
        gridRef.current?.focus();
      }
      wasEditingRef.current = !!editMode;
    },
    [editMode],
  );

  const { handleCopy, handlePaste } = useClipboard({
    selection,
    columns,
    data,
    onChange,
    createRow,
    readOnly,
  });

  useImperativeHandle(
    ref,
    () => ({
      selectCells,
      clearSelection,
      selection,
    }),
    [selectCells, clearSelection, selection],
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const focusRow = useCallback(
    (rowIndex: number) => {
      if (columns.length === 0) return;
      const firstEditableCol = columns.findIndex((col) => !col.disabled);
      const colIndex = firstEditableCol !== -1 ? firstEditableCol : 0;
      gridRef.current?.focus();
      selectCells({ colIndex, rowIndex });
    },
    [columns, selectCells],
  );

  const handleAddRow = useCallback(() => {
    const newRow = createRow();
    onChange([...data, newRow]);
    focusRow(data.length);
  }, [createRow, data, onChange, focusRow]);

  const handleCellDoubleClick = useCallback(
    (col: number) => {
      if (readOnly) return;
      const column = columns[col] as GridColumn | undefined;
      if (!column?.disabled && !column?.disableKeys) {
        startEditing("full");
      }
    },
    [columns, readOnly, startEditing],
  );

  const handleGutterClick = useCallback(
    (row: number, e: React.MouseEvent) => {
      selectCells({ rowIndex: row, extend: e.shiftKey });
    },
    [selectCells],
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
    rowCount: data.length,
    activeCell,
    selection,
    editMode,
    onCellMouseDown: handleCellMouseDown,
    onCellMouseEnter: handleCellMouseEnter,
    onCellDoubleClick: handleCellDoubleClick,
    onGutterClick: handleGutterClick,
    onCellChange: handleCellChange,
    stopEditing,
    startEditing,
    selectCells,
    clearSelection,
    blurGrid,
    gutterColumn,
    rowActions: readOnly ? undefined : rowActions,
    readOnly,
    variant,
  };

  return (
    <div className={isSpreadsheet ? "flex flex-col h-full" : "flex flex-col"}>
      <div
        ref={gridRef}
        role="grid"
        aria-rowcount={data.length}
        aria-colcount={columns.length}
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
          showActionsColumn={!readOnly && !!rowActions}
          onSelectColumn={(col) => selectCells({ colIndex: col })}
          onSelectAll={() => selectCells()}
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

      {!readOnly && (
        <AddRowButton
          label={addRowLabel}
          onClick={handleAddRow}
          variant={variant}
        />
      )}
    </div>
  );
}) as <TData extends Record<string, unknown>>(
  props: DataGridProps<TData> & {
    ref?: React.Ref<DataGridRef>;
  },
) => React.ReactElement;
