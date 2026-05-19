import { forwardRef, useRef } from "react";
import clsx from "clsx";
import { Table } from "@tanstack/react-table";
import {
  CellContextAction,
  DataGridVariant,
  GridColumn,
  GutterContextAction,
  RowAction,
} from "../types";
import { useContextMenuTarget, useGridKeyboard } from "../hooks";
import { GridRow } from "./grid-row";
import { GridContextMenuWrapper } from "./grid-context-menu-shell";
import { GridHeader } from "./grid-header";
import { GridRef } from "./types";

export type InlineGridProps<TData extends Record<string, unknown>> = {
  table: Table<TData>;
  columns: GridColumn[];
  onCellMouseDown: (col: number, row: number, e: React.MouseEvent) => void;
  onCellMouseEnter: (col: number, row: number) => void;
  onCellDoubleClick: (col: number) => void;
  onCellContextMenu?: (col: number, row: number, e: React.MouseEvent) => void;
  onGutterClick: (row: number, e: React.MouseEvent) => void;
  onGutterContextMenu?: (row: number, e: React.MouseEvent) => void;
  onCellChange: (rowIndex: number, columnId: string, value: unknown) => void;
  onEmptyAreaMouseDown: (e: React.MouseEvent) => void;
  onColumnHeaderClick: (colIndex: number, e: React.MouseEvent) => void;
  onSelectAll: () => void;
  onColumnSort?: (columnId: string, direction: "asc" | "desc") => void;
  selectCells: (options?: {
    colIndex?: number;
    rowIndex?: number;
    extend?: boolean;
  }) => void;
  clearSelection: () => void;
  blurGrid: () => void;
  gutterColumn: boolean;
  showRowNumbers: boolean;
  rowActions?: RowAction[];
  readOnly: boolean;
  variant: DataGridVariant;
  cellHasWarning?: (rowIndex: number, columnId: string) => boolean;
  cellContextActions?: CellContextAction<TData>[];
  gutterContextActions?: GutterContextAction<TData>[];
};

export const InlineGrid = forwardRef(function InlineGrid<
  TData extends Record<string, unknown>,
>(
  {
    table,
    columns,
    onCellMouseDown,
    onCellMouseEnter,
    onCellDoubleClick,
    onCellContextMenu,
    onGutterClick,
    onGutterContextMenu,
    onCellChange,
    onEmptyAreaMouseDown,
    onColumnHeaderClick,
    onSelectAll,
    onColumnSort,
    selectCells,
    clearSelection,
    blurGrid,
    gutterColumn,
    showRowNumbers,
    rowActions,
    readOnly,
    variant,
    cellHasWarning,
    cellContextActions,
    gutterContextActions,
  }: InlineGridProps<TData>,
  ref: React.ForwardedRef<GridRef>,
) {
  const containerRef = useRef<HTMLDivElement>(null);

  const rows = table.getRowModel().rows;

  useGridKeyboard({
    ref,
    table,
    selectCells,
    clearSelection,
    blurGrid,
    visibleRowCount: rows.length,
  });

  const {
    menuTarget,
    clearMenuTarget,
    wrappedCellContextMenu,
    wrappedGutterContextMenu,
  } = useContextMenuTarget({ onCellContextMenu, onGutterContextMenu });

  const rowsContent = rows.map((row, rowIndex) => {
    const isLast = rowIndex === rows.length - 1;
    return (
      <div
        key={row.id}
        role="row"
        aria-rowindex={rowIndex + 2}
        className={clsx(
          "flex h-8",
          table.options.enableColumnResizing ? "w-max" : "w-full",
        )}
      >
        <GridRow
          table={table}
          row={row}
          rowIndex={rowIndex}
          columns={columns}
          onCellMouseDown={onCellMouseDown}
          onCellMouseEnter={onCellMouseEnter}
          onCellDoubleClick={onCellDoubleClick}
          onCellContextMenu={wrappedCellContextMenu}
          onGutterClick={onGutterClick}
          onGutterContextMenu={wrappedGutterContextMenu}
          onCellChange={onCellChange}
          gutterColumn={gutterColumn}
          showRowNumbers={showRowNumbers}
          gutterIsLastRow={isLast}
          cellsIsLastRow={isLast}
          rowActions={rowActions}
          readOnly={readOnly}
          variant={variant}
          cellHasWarning={cellHasWarning}
        />
      </div>
    );
  });

  return (
    <GridContextMenuWrapper
      table={table}
      cellContextActions={cellContextActions}
      gutterContextActions={gutterContextActions}
      readOnly={readOnly}
      menuTarget={menuTarget}
      onClose={clearMenuTarget}
    >
      <div
        ref={containerRef}
        className="flex flex-col"
        onMouseDown={onEmptyAreaMouseDown}
        onContextMenu={(e) => {
          if (e.target === e.currentTarget) e.preventDefault();
        }}
      >
        <GridHeader
          table={table}
          showGutterColumn={gutterColumn}
          showActionsColumn={!readOnly && !!rowActions}
          onColumnHeaderClick={onColumnHeaderClick}
          onSelectAll={onSelectAll}
          variant={variant}
          onColumnSort={onColumnSort}
        />
        {rowsContent}
      </div>
    </GridContextMenuWrapper>
  );
}) as <TData extends Record<string, unknown>>(
  props: InlineGridProps<TData> & { ref?: React.Ref<GridRef> },
) => React.ReactElement;
