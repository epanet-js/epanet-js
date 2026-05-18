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
  DataGridVariant,
  GridColumn,
  RowAction,
  GridSelection,
  CellContextAction,
  GutterContextAction,
} from "./types";
import { useGridEditing, useMouseSelection } from "./hooks";
import {
  CellEditingFeature,
  CellRangeSelectionFeature,
  ClipboardFeature,
  clampActiveCell,
  clampRange,
  computeExtendedRange,
  computeTargetSelection,
  isActiveCellEqual,
  isCellSelected,
  isRangeEqual,
  type ClipboardCopyInfo,
  type ClipboardPasteInfo,
  type CopySelectionOptions,
} from "./features";
import type { CellPosition } from "./types";
import { InlineGrid, GridRef, VirtualGrid, AddRowButton } from "./shared";

export type DataGridWithFeaturesRef = {
  selectCells: (options?: {
    colIndex?: number;
    rowIndex?: number;
    extend?: boolean;
  }) => void;
  clearSelection: () => void;
  copySelection: (options?: CopySelectionOptions) => Promise<void>;
  selection: GridSelection | null;
};

type DataGridWithFeaturesProps<TData extends Record<string, unknown>> = {
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
  onColumnSort?: (columnId: string, direction: "asc" | "desc") => void;
  includeHeadersOnCopy?: boolean;
  onCopy?: (info: ClipboardCopyInfo) => void;
  onPaste?: (info: ClipboardPasteInfo) => void;
};

export const DataGridWithFeatures = forwardRef(function DataGridWithFeatures<
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
    onColumnSort,
    includeHeadersOnCopy = false,
    onCopy,
    onPaste,
  }: DataGridWithFeaturesProps<TData>,
  ref: React.ForwardedRef<DataGridWithFeaturesRef>,
) {
  const gridRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<GridRef>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  const table = useReactTable<TData>({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    _features: [
      CellEditingFeature,
      CellRangeSelectionFeature,
      ClipboardFeature,
    ],
    // Selection feature options
    rowCount: data.length,
    colCount: columns.length,
    onSelectionChange,
    // Clipboard feature options
    gridColumns: columns,
    onDataChange: onChange,
    createRow,
    readOnly,
    includeHeadersOnCopy,
    autoExtendOnPaste: autoAddNewRows,
    onClipboardCopy: onCopy,
    onClipboardPaste: onPaste,
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

  const editMode = table.getEditMode();
  const startEditing = table.startEditing;
  const stopEditing = table.stopEditing;

  const activeCell = table.getActiveCell();
  const selection = table.getSelection();

  const selectCells = useCallback(
    (options?: { colIndex?: number; rowIndex?: number; extend?: boolean }) => {
      const { colIndex, rowIndex, extend = false } = options ?? {};
      const rowCount = data.length;
      const colCount = columns.length;
      if (rowCount === 0 || colCount === 0) return;

      const target = computeTargetSelection(
        colIndex,
        rowIndex,
        colCount,
        rowCount,
      );

      const currentRange = table.getSelection();

      let nextRange: GridSelection;
      let nextActiveCell: CellPosition;

      if (extend && currentRange) {
        const { combined, movingCorner } = computeExtendedRange(
          currentRange,
          target,
        );
        nextRange = combined;
        nextActiveCell = {
          col: colIndex !== undefined ? movingCorner.col : target.min.col,
          row: rowIndex !== undefined ? movingCorner.row : target.min.row,
        };
      } else {
        nextRange = target;
        nextActiveCell = target.min;
      }

      const prevActive = table.getActiveCell();
      const isSingleCell =
        nextRange.min.col === nextRange.max.col &&
        nextRange.min.row === nextRange.max.row;
      const activeMoved =
        !prevActive ||
        prevActive.col !== nextActiveCell.col ||
        prevActive.row !== nextActiveCell.row;
      if (activeMoved || !isSingleCell) {
        table.stopEditing();
      }

      table.selectRange(nextRange);
      table.setActiveCell(nextActiveCell);
    },
    [data.length, columns.length, table],
  );

  const clearSelection = useCallback(() => {
    if (!table.getSelection() && !table.getActiveCell()) return;
    table.clearSelection();
    table.setActiveCell(null);
    stopEditing();
  }, [table, stopEditing]);

  useEffect(
    function clampWhenDataSizeChanges() {
      const rowCount = data.length;
      const colCount = columns.length;

      if (rowCount === 0 || colCount === 0) {
        if (table.getActiveCell() || table.getSelection()) {
          stopEditing();
          table.clearSelection();
          table.setActiveCell(null);
        }
        return;
      }

      const prevRange = table.getSelection();
      if (prevRange) {
        const clamped = clampRange(prevRange, colCount, rowCount);
        if (clamped && !isRangeEqual(prevRange, clamped)) {
          table.selectRange(clamped);
        }
      }

      const prevActive = table.getActiveCell();
      if (prevActive) {
        const clamped = clampActiveCell(prevActive, colCount, rowCount);
        if (!isActiveCellEqual(prevActive, clamped)) {
          table.setActiveCell(clamped);
        }
      }
    },
    [data.length, columns.length, stopEditing, table],
  );

  const lastNotifiedRef = useRef<GridSelection | null>(null);
  useEffect(() => {
    const prev = lastNotifiedRef.current;
    if (!isSameSelection(prev, selection)) {
      lastNotifiedRef.current = selection;
      onSelectionChange?.(selection);
    }
  }, [selection, onSelectionChange]);

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
        // After exiting edit mode the grid container should reclaim
        // keyboard focus so arrow navigation works. The only exception
        // is when focus currently sits on a boolean cell's checkbox —
        // checkboxes handle their own Space/Enter keys and shouldn't
        // be re-stolen. Other focusable cell elements (text inputs,
        // select buttons) don't have intrinsic grid-nav handling, so
        // the grid div takes over.
        const active = document.activeElement;
        const isCheckbox =
          active instanceof HTMLInputElement && active.type === "checkbox";
        if (!isCheckbox) {
          gridRef.current?.focus();
        }
      }
      wasEditingRef.current = !!editMode;
    },
    [editMode],
  );

  const handleCopy = useCallback(
    (e: React.ClipboardEvent) => {
      table.handleCopyEvent(e);
    },
    [table],
  );
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      table.handlePasteEvent(e);
    },
    [table],
  );
  const copySelectionImperative = useCallback(
    (options?: CopySelectionOptions) => table.copySelection(options),
    [table],
  );
  const pasteFromClipboard = useCallback(() => table.pasteSelection(), [table]);

  useImperativeHandle(
    ref,
    () => ({
      selectCells,
      clearSelection,
      copySelection: copySelectionImperative,
      selection,
    }),
    [selectCells, clearSelection, copySelectionImperative, selection],
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
            onCopy: () => void copySelectionImperative(),
            onPaste: () => void pasteFromClipboard(),
            readOnly,
          }
        : undefined,
    [
      cellContextActions,
      selection,
      getSortedRows,
      copySelectionImperative,
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
      // Only treat as a tab-into-the-grid when the grid div itself receives
      // focus. Inner-element focus (cell inputs, checkboxes) is handled by
      // the cell's own focus management; stealing it back to row 0 would
      // race with the click that just selected a cell.
      if (e.target !== gridRef.current) return;
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
    onColumnSort,
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
            ? "relative flex flex-col flex-1 min-h-0 outline-hidden"
            : "relative flex flex-col outline-hidden"
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
  props: DataGridWithFeaturesProps<TData> & {
    ref?: React.Ref<DataGridWithFeaturesRef>;
  },
) => React.ReactElement;

function isSameSelection(
  a: GridSelection | null,
  b: GridSelection | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.min.col === b.min.col &&
    a.min.row === b.min.row &&
    a.max.col === b.max.col &&
    a.max.row === b.max.row
  );
}
