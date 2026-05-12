import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
} from "@tanstack/react-table";
import {
  DataGridRef,
  DataGridVariant,
  GridColumn,
  RowAction,
  GridSelection,
  CellContextAction,
  GutterContextAction,
} from "./types";
import { isCellSelected } from "./hooks";
import {
  useSelection,
  useGridEditing,
  useClipboard,
  useEditMode,
  useMouseSelection,
} from "./hooks";
import { InlineGrid, GridRef, VirtualGrid, AddRowButton } from "./shared";

type DataGridProps<TData extends Record<string, unknown>> = {
  data: TData[];
  columns: GridColumn[];
  onChange: (data: TData[]) => void;
  createRow: () => TData;
  readOnly?: boolean;
  resizable?: boolean;
  minColumnSizePx?: number;
  emptyState?: React.ReactNode;
  rowActions?: RowAction[];
  cellContextActions?: CellContextAction<TData>[];
  gutterContextActions?: GutterContextAction<TData>[];
  addRowLabel?: string;
  gutterColumn?: "hidden" | "selection" | "numbered";
  onSelectionChange?: (selection: GridSelection | null) => void;
  variant?: DataGridVariant;
  cellHasWarning?: (rowIndex: number, columnId: string) => boolean;
  autoAddNewRows?: boolean;
  sortable?: boolean;
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
    resizable = false,
    minColumnSizePx = 50,
    emptyState,
    rowActions,
    cellContextActions,
    gutterContextActions,
    addRowLabel,
    gutterColumn = "hidden",
    onSelectionChange,
    variant = "spreadsheet",
    cellHasWarning,
    autoAddNewRows = false,
    sortable = false,
  }: DataGridProps<TData>,
  ref: React.ForwardedRef<DataGridRef>,
) {
  const gridRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<GridRef>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    // Column sizing options
    defaultColumn: {
      minSize: minColumnSizePx,
      size: 150,
      maxSize: Number.MAX_SAFE_INTEGER,
    },
    columnResizeMode: "onChange",
    enableColumnResizing: resizable,
    // Data sorting options
    getSortedRowModel: getSortedRowModel(),
    enableSorting: sortable,
    enableSortingRemoval: true,
    enableMultiSort: false,
  });

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
    const currentData = dataRef.current;
    const newRow = createRow();
    onChange([...currentData, newRow]);
    focusRow(currentData.length);
  }, [createRow, onChange, focusRow]);

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
    onAddRow: autoAddNewRows ? handleAddRow : undefined,
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

  const { handleCopy, handlePaste, copyToClipboard, pasteFromClipboard } =
    useClipboard({
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

  const handleCellContextMenu = useCallback(
    (col: number, row: number) => {
      if (!isCellSelected(selection, col, row)) {
        selectCells({ colIndex: col, rowIndex: row });
      }
    },
    [selection, selectCells],
  );

  const handleGutterContextMenu = useCallback(
    (row: number) => {
      const rowIsFullySelected =
        selection !== null &&
        selection.min.col === 0 &&
        selection.max.col === columns.length - 1 &&
        row >= selection.min.row &&
        row <= selection.max.row;
      if (!rowIsFullySelected) {
        selectCells({ rowIndex: row });
      }
    },
    [selection, selectCells, columns.length],
  );

  const tableRef = useRef(table);
  tableRef.current = table;

  const getSortedRows = useCallback(
    () => tableRef.current.getRowModel().rows.map((r) => r.original),
    [],
  );

  const cellContextMenu = useMemo(
    () =>
      cellContextActions
        ? {
            actions: cellContextActions,
            selection,
            getSortedRows,
            onCopy: () => void copyToClipboard(),
            onPaste: () => void pasteFromClipboard(),
            readOnly,
          }
        : undefined,
    [
      cellContextActions,
      selection,
      getSortedRows,
      copyToClipboard,
      pasteFromClipboard,
      readOnly,
    ],
  );

  const gutterContextMenu = useMemo(
    () =>
      gutterContextActions && gutterContextActions.length > 0
        ? { actions: gutterContextActions, selection, getSortedRows }
        : undefined,
    [gutterContextActions, selection, getSortedRows],
  );

  const handleCellChange = useCallback(
    (rowIndex: number, columnId: string, value: unknown) => {
      const newData = dataRef.current.map((row, idx) => {
        if (idx === rowIndex) {
          return { ...row, [columnId]: value };
        }
        return row;
      });
      dataRef.current = newData;
      onChange(newData);
    },
    [onChange],
  );

  const handleFocus = useCallback(
    (e: React.FocusEvent) => {
      if (activeCell || data.length === 0) return;
      const target = e.target as HTMLElement;
      if (!gridRef.current?.contains(target)) return;
      if (target.closest('[role="columnheader"]')) return;
      focusRow(0);
    },
    [activeCell, data.length, focusRow],
  );

  const handleEmptyAreaMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.target !== e.currentTarget) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const onScrollbar =
        e.clientX > rect.left + e.currentTarget.clientWidth ||
        e.clientY > rect.top + e.currentTarget.clientHeight;
      if (!onScrollbar) {
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
    onCellContextMenu: cellContextMenu
      ? (col: number, row: number) => handleCellContextMenu(col, row)
      : undefined,
    onGutterClick: handleGutterClick,
    onGutterContextMenu: gutterContextMenu
      ? (row: number) => handleGutterContextMenu(row)
      : undefined,
    onCellChange: handleCellChange,
    onEmptyAreaMouseDown: handleEmptyAreaMouseDown,
    onColumnHeaderClick: (col: number, e: React.MouseEvent) =>
      selectCells({ colIndex: col, extend: e.shiftKey }),
    onSelectAll: () => selectCells(),
    stopEditing,
    startEditing,
    selectCells,
    clearSelection,
    blurGrid,
    gutterColumn: gutterColumn !== "hidden",
    showRowNumbers: gutterColumn === "numbered",
    rowActions: readOnly ? undefined : rowActions,
    readOnly,
    variant,
    cellHasWarning,
    cellContextMenu,
    gutterContextMenu,
  };

  return (
    <div
      className={
        isSpreadsheet ? "flex flex-col h-full text-sm" : "flex flex-col text-sm"
      }
    >
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
        {isSpreadsheet ? (
          <VirtualGrid ref={rowsRef} {...rowsProps} />
        ) : (
          <InlineGrid ref={rowsRef} {...rowsProps} />
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
