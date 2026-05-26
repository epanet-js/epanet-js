import { Table } from "@tanstack/react-table";
import { Virtualizer } from "@tanstack/react-virtual";
import clsx from "clsx";
import { DataGridVariant, RowAction } from "../types";
import { GridRow } from "./grid-row";

export type VirtualRowsProps<TData extends Record<string, unknown>> = {
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  table: Table<TData>;
  hasVerticalScroll: boolean;
  onCellMouseDown: (col: number, row: number, e: React.MouseEvent) => void;
  onCellMouseEnter: (col: number, row: number) => void;
  onCellDoubleClick: (col: number) => void;
  onCellContextMenu?: (col: number, row: number, e: React.MouseEvent) => void;
  onGutterClick: (row: number, e: React.MouseEvent) => void;
  onGutterContextMenu?: (row: number, e: React.MouseEvent) => void;
  onCellChange: (rowIndex: number, columnId: string, value: unknown) => void;
  gutterColumn: boolean;
  showRowNumbers: boolean;
  rowActions?: RowAction[];
  readOnly: boolean;
  variant: DataGridVariant;
  cellHasWarning?: (rowIndex: number, columnId: string) => boolean;
};

export function VirtualRows<TData extends Record<string, unknown>>({
  rowVirtualizer,
  table,
  hasVerticalScroll,
  onCellMouseDown,
  onCellMouseEnter,
  onCellDoubleClick,
  onCellContextMenu,
  onGutterClick,
  onGutterContextMenu,
  onCellChange,
  gutterColumn,
  showRowNumbers,
  rowActions,
  readOnly,
  variant,
  cellHasWarning,
}: VirtualRowsProps<TData>) {
  const totalSize = rowVirtualizer.getTotalSize();
  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <div
      style={{
        height: totalSize,
        position: "relative",
        minWidth: table.getTotalSize(),
      }}
    >
      {virtualRows.map((virtualRow) => {
        const rowsModel = table.getRowModel();
        const row = rowsModel.rows[virtualRow.index];
        const visualIndex = virtualRow.index;
        const isLast = virtualRow.index === rowsModel.rows.length - 1;

        return (
          <div
            key={row.id}
            role="row"
            aria-rowindex={visualIndex + 2}
            className={clsx(
              "flex absolute h-8",
              table.options.enableColumnResizing ? "w-max" : "w-full",
            )}
            style={{ transform: `translateY(${virtualRow.start}px)` }}
          >
            <GridRow
              table={table}
              row={row}
              rowIndex={visualIndex}
              onCellMouseDown={onCellMouseDown}
              onCellMouseEnter={onCellMouseEnter}
              onCellDoubleClick={onCellDoubleClick}
              onCellContextMenu={onCellContextMenu}
              onGutterClick={onGutterClick}
              onGutterContextMenu={onGutterContextMenu}
              onCellChange={onCellChange}
              gutterColumn={gutterColumn}
              showRowNumbers={showRowNumbers}
              gutterIsLastRow={isLast && !hasVerticalScroll}
              cellsIsLastRow={isLast && hasVerticalScroll}
              rowActions={rowActions}
              readOnly={readOnly}
              variant={variant}
              cellHasWarning={cellHasWarning}
            />
          </div>
        );
      })}
    </div>
  );
}
