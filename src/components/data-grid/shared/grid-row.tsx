import { Row, Cell } from "@tanstack/react-table";
import {
  CellPosition,
  DataGridVariant,
  EditMode,
  GridColumn,
  GridSelection,
  RowAction,
} from "../types";
import { isCellSelected, isCellActive, isSingleCellSelection } from "../hooks";
import { GridDataCell } from "./grid-data-cell";
import { RowGutterCell } from "./row-gutter-cell";
import { RowActionsCell } from "./row-actions-cell";

export type GridRowProps<TData> = {
  row: Row<TData>;
  rowIndex: number;
  columns: GridColumn[];
  activeCell: CellPosition | null;
  selection: GridSelection | null;
  editMode: EditMode;
  onCellMouseDown: (col: number, row: number, e: React.MouseEvent) => void;
  onCellMouseEnter: (col: number, row: number) => void;
  onCellDoubleClick: (col: number) => void;
  onGutterClick: (row: number, e: React.MouseEvent) => void;
  onCellChange: (rowIndex: number, columnId: string, value: unknown) => void;
  stopEditing: () => void;
  startEditing: () => void;
  gutterColumn: boolean;
  gutterIsLastRow: boolean;
  cellsIsLastRow: boolean;
  rowActions?: RowAction[];
  readOnly: boolean;
  variant: DataGridVariant;
};

export function GridRow<TData>({
  row,
  rowIndex,
  columns,
  activeCell,
  selection,
  editMode,
  onCellMouseDown,
  onCellMouseEnter,
  onCellDoubleClick,
  onGutterClick,
  onCellChange,
  stopEditing,
  startEditing,
  gutterColumn,
  gutterIsLastRow,
  cellsIsLastRow,
  rowActions,
  readOnly,
  variant,
}: GridRowProps<TData>) {
  return (
    <>
      {gutterColumn && (
        <RowGutterCell
          rowIndex={rowIndex}
          onClick={(e) => onGutterClick(rowIndex, e)}
          variant={variant}
          isLastRow={gutterIsLastRow}
        />
      )}

      {row.getVisibleCells().map((cell: Cell<TData, unknown>, colIndex) => {
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
            rowIndex={rowIndex}
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
            onBlur={stopEditing}
            onStartEditing={startEditing}
            onChange={
              accessorKey
                ? (value) => onCellChange(rowIndex, accessorKey, value)
                : undefined
            }
            CellComponent={column.cellComponent}
            variant={variant}
            isLastRow={cellsIsLastRow}
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
