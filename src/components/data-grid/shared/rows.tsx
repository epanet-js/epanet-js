import { forwardRef, useImperativeHandle } from "react";
import { Table } from "@tanstack/react-table";
import {
  CellPosition,
  DataGridVariant,
  EditMode,
  GridColumn,
  GridSelection,
  RowAction,
} from "../types";
import {
  useRowsNavigation,
  isCellSelected,
  isCellActive,
  isSingleCellSelection,
} from "../hooks";
import { GridDataCell } from "./grid-data-cell";
import { RowGutterCell } from "./row-gutter-cell";
import { RowActionsCell } from "./row-actions-cell";

export type RowsRef = {
  handleKeyDown: (e: React.KeyboardEvent) => void;
};

export type RowsProps<TData> = {
  table: Table<TData>;
  columns: GridColumn[];
  rowCount: number;
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
  selectCells: (options?: {
    colIndex?: number;
    rowIndex?: number;
    extend?: boolean;
  }) => void;
  clearSelection: () => void;
  blurGrid: () => void;
  gutterColumn: boolean;
  rowActions?: RowAction[];
  readOnly: boolean;
  variant: DataGridVariant;
};

export const Rows = forwardRef(function Rows<TData>(
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
    onGutterClick,
    onCellChange,
    stopEditing,
    startEditing,
    selectCells,
    clearSelection,
    blurGrid,
    gutterColumn,
    rowActions,
    readOnly,
    variant,
  }: RowsProps<TData>,
  ref: React.ForwardedRef<RowsRef>,
) {
  const rows = table.getRowModel().rows;
  const colCount = columns.length;
  const visibleRowCount = rows.length;
  const isInteractive = isSingleCellSelection(selection);

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
    <div className="flex flex-col">
      {rows.map((row, rowIndex) => {
        const isLast = rowIndex === rows.length - 1;

        return (
          <div
            key={row.id}
            role="row"
            aria-rowindex={rowIndex + 2}
            className="flex w-full h-8"
          >
            {gutterColumn && (
              <RowGutterCell
                rowIndex={rowIndex}
                onClick={(e) => onGutterClick(rowIndex, e)}
                variant={variant}
                isLastRow={isLast}
              />
            )}

            {row.getVisibleCells().map((cell, colIndex) => {
              const column = columns[colIndex];
              const accessorKey = column.accessorKey;
              const cellSelected = isCellSelected(
                selection,
                colIndex,
                rowIndex,
              );

              return (
                <GridDataCell
                  key={cell.id}
                  cell={cell}
                  colIndex={colIndex}
                  rowIndex={rowIndex}
                  isSelected={cellSelected}
                  isActive={isCellActive(activeCell, colIndex, rowIndex)}
                  editMode={editMode}
                  isInteractive={isInteractive}
                  readOnly={readOnly || !!column.disabled}
                  selectionEdge={
                    cellSelected && selection
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
                  isLastRow={isLast}
                />
              );
            })}

            <RowActionsCell
              rowActions={rowActions}
              rowIndex={rowIndex}
              variant={variant}
              isLastRow={isLast}
              disabled={readOnly}
            />
          </div>
        );
      })}
    </div>
  );
}) as <TData>(
  props: RowsProps<TData> & { ref?: React.Ref<RowsRef> },
) => React.ReactElement;
