import { forwardRef, useImperativeHandle, useRef } from "react";
import clsx from "clsx";
import { Table } from "@tanstack/react-table";
import {
  CellPosition,
  DataGridVariant,
  EditMode,
  GridColumn,
  GridSelection,
  RowAction,
} from "../types";
import { useFitColumnWidth, useRowsNavigation } from "../hooks";
import { GridRow } from "./grid-row";
import {
  CellContextMenuConfig,
  GutterContextMenuConfig,
} from "./grid-context-menus";
import { GridHeader } from "./grid-header";
import { GridRef } from "./types";

export type InlineGridProps<TData extends Record<string, unknown>> = {
  table: Table<TData>;
  columns: GridColumn[];
  rowCount: number;
  activeCell: CellPosition | null;
  selection: GridSelection | null;
  editMode: EditMode;
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
  stopEditing: () => void;
  startEditing: () => void;
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
  cellContextMenu?: CellContextMenuConfig<TData>;
  gutterContextMenu?: GutterContextMenuConfig<TData>;
};

export const InlineGrid = forwardRef(function InlineGrid<
  TData extends Record<string, unknown>,
>(
  {
    table,
    columns,
    rowCount,
    activeCell,
    selection,
    editMode,
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
    stopEditing,
    startEditing,
    selectCells,
    clearSelection,
    blurGrid,
    gutterColumn,
    showRowNumbers,
    rowActions,
    readOnly,
    variant,
    cellHasWarning,
    cellContextMenu,
    gutterContextMenu,
  }: InlineGridProps<TData>,
  ref: React.ForwardedRef<GridRef>,
) {
  const containerRef = useRef<HTMLDivElement>(null);

  const { fitWidthToContent } = useFitColumnWidth(table, containerRef);

  const rows = table.getRowModel().rows;
  const colCount = columns.length;
  const visibleRowCount = rows.length;

  const handleKeyDown = useRowsNavigation({
    activeCell,
    rowCount,
    colCount,
    editMode,
    selectCells,
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

  return (
    <div
      ref={containerRef}
      className="flex flex-col"
      onMouseDown={onEmptyAreaMouseDown}
    >
      <GridHeader
        table={table}
        showGutterColumn={gutterColumn}
        showActionsColumn={!readOnly && !!rowActions}
        onColumnHeaderClick={onColumnHeaderClick}
        onSelectAll={onSelectAll}
        variant={variant}
        selection={selection}
        rowCount={rowCount}
        fitWidthToContent={fitWidthToContent}
      />
      {rows.map((row, rowIndex) => {
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
              row={row}
              rowIndex={rowIndex}
              columns={columns}
              activeCell={activeCell}
              selection={selection}
              editMode={editMode}
              onCellMouseDown={onCellMouseDown}
              onCellMouseEnter={onCellMouseEnter}
              onCellDoubleClick={onCellDoubleClick}
              onCellContextMenu={onCellContextMenu}
              onGutterClick={onGutterClick}
              onGutterContextMenu={onGutterContextMenu}
              onCellChange={onCellChange}
              stopEditing={stopEditing}
              startEditing={startEditing}
              gutterColumn={gutterColumn}
              showRowNumbers={showRowNumbers}
              gutterIsLastRow={isLast}
              cellsIsLastRow={isLast}
              rowActions={rowActions}
              readOnly={readOnly}
              variant={variant}
              cellHasWarning={cellHasWarning}
              cellContextMenu={cellContextMenu}
              gutterContextMenu={gutterContextMenu}
            />
          </div>
        );
      })}
    </div>
  );
}) as <TData extends Record<string, unknown>>(
  props: InlineGridProps<TData> & { ref?: React.Ref<GridRef> },
) => React.ReactElement;
