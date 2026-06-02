import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import {
  type ColumnDef,
  useReactTable,
  getCoreRowModel,
} from "@tanstack/react-table";
import { getStickySortedRowModel } from "./utils/get-sticky-sorted-row-model";
import {
  DataGridVariant,
  RowAction,
  GridSelection,
  CellContextAction,
  GutterContextAction,
  GridColumn,
} from "./types";
import { useGridEditing, useMouseSelection } from "./hooks";
import {
  CellEditingFeature,
  CellRangeSelectionFeature,
  CellRenderingFeature,
  ClipboardFeature,
  ColumnSizingFeature,
  CustomHeaderActionsFeature,
  type ClipboardCopyInfo,
  type ClipboardPasteInfo,
  type CopySelectionOptions,
} from "./features";
import type { CellPosition } from "./types";
import { InlineGrid, GridRef, VirtualGrid, AddRowButton } from "./shared";

export type DataGridRef = {
  selectCells: (options?: {
    colIndex?: number;
    rowIndex?: number;
    extend?: boolean;
  }) => void;
  clearSelection: () => void;
  copySelection: (options?: CopySelectionOptions) => Promise<void>;
  selection: GridSelection | null;
};

type DataGridProps<TData extends Record<string, unknown>> = {
  data: TData[];
  columns: GridColumn<TData>[];
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
  getRowId?: (row: TData, index: number) => string;
  onColumnSort?: (columnId: string, direction: "asc" | "desc") => void;
  includeHeadersOnCopy?: boolean;
  onCopy?: (info: ClipboardCopyInfo) => void;
  onPaste?: (info: ClipboardPasteInfo) => void;
  onDelete?: (rowsToDelete: TData[]) => void;
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
    getRowId,
    onColumnSort,
    includeHeadersOnCopy = false,
    onCopy,
    onPaste,
    onDelete,
  }: DataGridProps<TData>,
  ref: React.ForwardedRef<DataGridRef>,
) {
  const gridRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<GridRef>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  const table = useReactTable<TData>({
    data,
    columns: columns as ColumnDef<TData>[],
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    _features: [
      CellEditingFeature,
      CellRangeSelectionFeature,
      ClipboardFeature,
      CellRenderingFeature,
      ColumnSizingFeature,
      CustomHeaderActionsFeature,
    ],
    // Clipboard feature options
    onDataChange: onChange,
    createRow,
    readOnly,
    onDelete,
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
    getSortedRowModel: getStickySortedRowModel(),
    enableSorting: sortable,
    enableSortingRemoval: true,
    enableMultiSort: false,
  });

  const activeCell = table.getActiveCell();
  const selection = table.getSelection();
  const editMode = table.getEditMode();

  const selectCells = useCallback(
    (options?: { colIndex?: number; rowIndex?: number; extend?: boolean }) => {
      const { colIndex, rowIndex, extend = false } = options ?? {};
      const result = table.updateSelection({
        col: colIndex,
        row: rowIndex,
        extend,
      });
      if (!result) return;

      const { range, movingCorner } = result;
      const nextActiveCell: CellPosition = {
        col: colIndex !== undefined ? movingCorner.col : range.min.col,
        row: rowIndex !== undefined ? movingCorner.row : range.min.row,
      };

      const prevActive = table.getActiveCell();
      const isSingleCell =
        range.min.col === range.max.col && range.min.row === range.max.row;
      const activeMoved =
        !prevActive ||
        prevActive.col !== nextActiveCell.col ||
        prevActive.row !== nextActiveCell.row;
      if (activeMoved || !isSingleCell) {
        table.stopEditing();
      }

      table.setActiveCell(nextActiveCell);
    },
    [table],
  );

  const clearSelection = useCallback(() => {
    if (!table.getSelection() && !table.getActiveCell()) return;
    table.clearSelection();
    table.setActiveCell(null);
    table.stopEditing();
  }, [table]);

  const lastNotifiedRef = useRef<GridSelection | null>(null);
  useEffect(
    function notifySelectionChange() {
      const prev = lastNotifiedRef.current;
      if (!isSameSelection(prev, selection)) {
        lastNotifiedRef.current = selection;
        onSelectionChange?.(selection);
      }
    },
    [selection, onSelectionChange],
  );

  const { handleCellMouseDown, handleCellMouseEnter } = useMouseSelection({
    editMode,
    selectCells,
  });

  const blurGrid = useCallback(() => {
    gridRef.current?.blur();
  }, []);

  const focusRow = useCallback(
    (rowIndex: number) => {
      const leafColumns = table.getVisibleLeafColumns();
      if (leafColumns.length === 0) return;
      const firstEditableCol = leafColumns.findIndex(
        (col) => !col.isReadOnly(rowIndex),
      );
      const colIndex = firstEditableCol !== -1 ? firstEditableCol : 0;
      gridRef.current?.focus();
      selectCells({ colIndex, rowIndex });
    },
    [table, selectCells],
  );

  const handleAddRow = useCallback(() => {
    const currentData = dataRef.current;
    const newRow = createRow();
    onChange([...currentData, newRow]);
    focusRow(currentData.length);
  }, [createRow, onChange, focusRow]);

  const handleEditingKeyDown = useGridEditing({
    table,
    selectCells,
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

  useImperativeHandle(
    ref,
    () => ({
      selectCells,
      clearSelection,
      copySelection: table.copySelection,
      selection,
    }),
    [selectCells, clearSelection, table, selection],
  );

  const handleCellDoubleClick = useCallback(
    (col: number) => {
      const column = table.getVisibleLeafColumns()[col];
      const rowIndex = table.getActiveCell()?.row ?? 0;
      if (column && !column.isReadOnly(rowIndex)) {
        table.startEditing("full");
      }
    },
    [table],
  );

  const handleGutterClick = useCallback(
    (row: number, e: React.MouseEvent) => {
      selectCells({ rowIndex: row, extend: e.shiftKey });
    },
    [selectCells],
  );

  const handleCellContextMenu = useCallback(
    (col: number, row: number) => {
      if (!table.isCellSelected(col, row)) {
        selectCells({ colIndex: col, rowIndex: row });
      }
    },
    [table, selectCells],
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
    onCellMouseDown: handleCellMouseDown,
    onCellMouseEnter: handleCellMouseEnter,
    onCellDoubleClick: handleCellDoubleClick,
    onCellContextMenu: cellContextActions
      ? (col: number, row: number) => handleCellContextMenu(col, row)
      : undefined,
    onGutterClick: handleGutterClick,
    onGutterContextMenu: gutterContextActions
      ? (row: number) => handleGutterContextMenu(row)
      : undefined,
    onCellChange: handleCellChange,
    onEmptyAreaMouseDown: handleEmptyAreaMouseDown,
    onColumnHeaderClick: (col: number, e: React.MouseEvent) =>
      selectCells({ colIndex: col, extend: e.shiftKey }),
    onSelectAll: () => selectCells(),
    onColumnSort,
    selectCells,
    clearSelection,
    blurGrid,
    gutterColumn: gutterColumn !== "hidden",
    showRowNumbers: gutterColumn === "numbered",
    rowActions: readOnly ? undefined : rowActions,
    readOnly,
    variant,
    cellHasWarning,
    cellContextActions,
    gutterContextActions,
  };

  return (
    <div
      className={
        isSpreadsheet
          ? "flex flex-col h-full text-size-base"
          : "flex flex-col text-size-base"
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
        onCopy={table.handleCopyEvent}
        onPaste={table.handlePasteEvent}
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
  props: DataGridProps<TData> & {
    ref?: React.Ref<DataGridRef>;
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
