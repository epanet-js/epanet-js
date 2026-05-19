import { Row, Cell, Table } from "@tanstack/react-table";

export const ROW_HEIGHT = 32; // h-8, needed for virtualizer estimateSize
import { DataGridVariant, GridColumn, RowAction } from "../types";
import {
  isCellSelected,
  isCellActive,
  isSingleCellSelection,
  isFullRowSelected,
} from "../hooks";
import { GridDataCell } from "./grid-data-cell";
import { RowGutterCell } from "./row-gutter-cell";
import { RowActionsCell } from "./row-actions-cell";

export type GridRowProps<TData extends Record<string, unknown>> = {
  table: Table<TData>;
  row: Row<TData>;
  rowIndex: number;
  columns: GridColumn[];
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
  columns,
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
  const activeCell = table.getActiveCell();
  const selection = table.getSelection();
  const editMode = table.getEditMode();

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
          isRowSelected={
            isFullRowSelected(selection, columns.length) &&
            isCellSelected(selection, 0, rowIndex)
          }
        />
      )}

      {row
        .getVisibleCells()
        .map((cell: Cell<TData, unknown>, colIndex, cells) => {
          const column = columns[colIndex];
          const accessorKey = column.accessorKey;
          const isSelected = isCellSelected(selection, colIndex, rowIndex);
          const isActive = isCellActive(activeCell, colIndex, rowIndex);
          const isCurrentIteractiveCell =
            isActive && isSingleCellSelection(selection);

          return (
            <GridDataCell
              key={cell.id}
              cell={cell}
              colIndex={colIndex}
              isSelected={isSelected}
              isActive={isActive}
              editMode={isCurrentIteractiveCell ? editMode : false}
              isInteractive={isCurrentIteractiveCell}
              readOnly={readOnly || !!column.disabled}
              selectionEdge={
                isSelected && selection
                  ? {
                      top: rowIndex === selection.min.row,
                      bottom: rowIndex === selection.max.row,
                      left: colIndex === selection.min.col,
                      right: colIndex === selection.max.col,
                    }
                  : undefined
              }
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
              CellComponent={column.cellComponent}
              variant={variant}
              isLastRow={cellsIsLastRow}
              isLastCol={colIndex === cells.length - 1}
              hasWarning={
                accessorKey
                  ? (cellHasWarning?.(rowIndex, accessorKey) ?? false)
                  : false
              }
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
