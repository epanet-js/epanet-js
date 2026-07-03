import { Row, Cell, Table } from "@tanstack/react-table";
import { DataGridVariant, RowAction } from "../types";
import { GridDataCell } from "./grid-data-cell";
import { RowGutterCell } from "./row-gutter-cell";
import { RowActionsCell } from "./row-actions-cell";
import { FIXED_COLUMN_SIZE } from "./dimensions";

export type GridRowProps<TData extends Record<string, unknown>> = {
  table: Table<TData>;
  row: Row<TData>;
  rowIndex: number;
  onCellMouseDown: (col: number, row: number, e: React.MouseEvent) => void;
  onCellMouseEnter: (col: number, row: number) => void;
  onCellDoubleClick: (col: number) => void;
  onCellContextMenu?: (col: number, row: number, e: React.MouseEvent) => void;
  onGutterClick: (row: number, e: React.MouseEvent) => void;
  onGutterContextMenu?: (row: number, e: React.MouseEvent) => void;
  onCellChange: (rowIndex: number, columnId: string, value: unknown) => void;
  gutterColumn: boolean;
  showRowNumbers: boolean;
  gutterIsLastRow: boolean;
  cellsIsLastRow: boolean;
  rowActions?: RowAction[];
  readOnly: boolean;
  variant: DataGridVariant;
  cellHasWarning?: (rowIndex: number, columnId: string) => boolean;
};

export function GridRow<TData extends Record<string, unknown>>({
  table,
  row,
  rowIndex,
  onCellMouseDown,
  onCellMouseEnter,
  onCellDoubleClick,
  onCellContextMenu,
  onGutterClick,
  onGutterContextMenu,
  onCellChange,
  gutterColumn,
  showRowNumbers,
  gutterIsLastRow,
  cellsIsLastRow,
  rowActions,
  readOnly,
  variant,
  cellHasWarning,
}: GridRowProps<TData>) {
  const cells = row.getVisibleCells();
  const gutterWidth = gutterColumn ? FIXED_COLUMN_SIZE : 0;
  let pinnedLeftCursor = gutterWidth;

  return (
    <>
      {gutterColumn && (
        <RowGutterCell
          rowIndex={rowIndex}
          onClick={(e) => onGutterClick(rowIndex, e)}
          onContextMenu={(e) => onGutterContextMenu?.(rowIndex, e)}
          variant={variant}
          isLastRow={gutterIsLastRow}
          showRowNumbers={showRowNumbers}
          isRowSelected={row.isFullySelected()}
        />
      )}

      {cells.map((cell: Cell<TData, unknown>, colIndex) => {
        const accessorKey = cell.column.id;
        const isPinnedLeft = cell.column.getIsPinned() === "left";
        const pinnedLeftOffset = isPinnedLeft ? pinnedLeftCursor : undefined;
        if (isPinnedLeft) pinnedLeftCursor += cell.column.getSize();
        const readOnly = cell.column.isReadOnly(cell.row.index);
        return (
          <GridDataCell
            key={cell.id}
            cell={cell}
            readOnly={readOnly}
            onMouseDown={(e) => onCellMouseDown(colIndex, rowIndex, e)}
            onMouseEnter={() => onCellMouseEnter(colIndex, rowIndex)}
            onDoubleClick={() => onCellDoubleClick(colIndex)}
            onContextMenu={(e) => onCellContextMenu?.(colIndex, rowIndex, e)}
            onBlur={table.stopEditing}
            onStartEditing={table.startEditing}
            onChange={
              accessorKey
                ? (value) => onCellChange(row.index, accessorKey, value)
                : undefined
            }
            variant={variant}
            isLastRow={cellsIsLastRow}
            isLastCol={colIndex === cells.length - 1}
            hasWarning={
              (!readOnly && cell.column.hasWarning(cell.getValue())) ||
              (accessorKey
                ? (cellHasWarning?.(cell.row.index, accessorKey) ?? false)
                : false)
            }
            pinnedLeftOffset={pinnedLeftOffset}
          />
        );
      })}

      <RowActionsCell
        rowActions={rowActions}
        rowIndex={rowIndex}
        variant={variant}
        isLastRow={cellsIsLastRow}
        disabled={readOnly}
      />
    </>
  );
}
