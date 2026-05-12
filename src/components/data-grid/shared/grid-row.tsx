import { Row, Cell } from "@tanstack/react-table";

export const ROW_HEIGHT = 32; // h-8, needed for virtualizer estimateSize
import {
  CellPosition,
  DataGridVariant,
  EditMode,
  GridColumn,
  GridSelection,
  RowAction,
} from "../types";
import {
  isCellSelected,
  isCellActive,
  isSingleCellSelection,
  isFullRowSelected,
} from "../hooks";
import { GridDataCell } from "./grid-data-cell";
import { RowGutterCell } from "./row-gutter-cell";
import { RowActionsCell } from "./row-actions-cell";
import {
  CellContextMenuConfig,
  GutterContextMenuConfig,
} from "./grid-context-menus";

export type GridRowProps<TData extends Record<string, unknown>> = {
  row: Row<TData>;
  rowIndex: number;
  columns: GridColumn[];
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
  stopEditing: () => void;
  startEditing: () => void;
  gutterColumn: boolean;
  showRowNumbers: boolean;
  gutterIsLastRow: boolean;
  cellsIsLastRow: boolean;
  rowActions?: RowAction[];
  readOnly: boolean;
  variant: DataGridVariant;
  cellHasWarning?: (rowIndex: number, columnId: string) => boolean;
  cellContextMenu?: CellContextMenuConfig<TData>;
  gutterContextMenu?: GutterContextMenuConfig<TData>;
};

export function GridRow<TData extends Record<string, unknown>>({
  row,
  rowIndex,
  columns,
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
  stopEditing,
  startEditing,
  gutterColumn,
  showRowNumbers,
  gutterIsLastRow,
  cellsIsLastRow,
  rowActions,
  readOnly,
  variant,
  cellHasWarning,
  cellContextMenu,
  gutterContextMenu,
}: GridRowProps<TData>) {
  return (
    <>
      {gutterColumn && (
        <RowGutterCell
          rowIndex={rowIndex}
          onClick={(e) => onGutterClick(rowIndex, e)}
          onContextMenu={
            onGutterContextMenu
              ? (e) => onGutterContextMenu(rowIndex, e)
              : undefined
          }
          variant={variant}
          isLastRow={gutterIsLastRow}
          showRowNumbers={showRowNumbers}
          isRowSelected={
            isFullRowSelected(selection, columns.length) &&
            isCellSelected(selection, 0, rowIndex)
          }
          gutterContextMenu={gutterContextMenu}
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
              onContextMenu={
                onCellContextMenu
                  ? (e) => onCellContextMenu(colIndex, rowIndex, e)
                  : undefined
              }
              onBlur={stopEditing}
              onStartEditing={startEditing}
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
              cellContextMenu={cellContextMenu}
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
