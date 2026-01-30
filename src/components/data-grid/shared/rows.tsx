import { forwardRef, useImperativeHandle } from "react";
import { Table } from "@tanstack/react-table";
import {
  CellPosition,
  DataGridVariant,
  GridColumn,
  GridSelection,
  RowAction,
} from "../types";
import { useRowsNavigation } from "../hooks";
import { GridDataCell } from "./grid-data-cell";
import { RowGutterCell } from "./row-gutter-cell";
import { RowActionsCell } from "./row-actions-cell";

export type RowsRef = {
  handleKeyDown: (e: React.KeyboardEvent) => void;
};

type RowsProps<TData> = {
  table: Table<TData>;
  columns: GridColumn[];
  selection: GridSelection | null;
  isEditing: boolean;
  isCellSelected: (col: number, row: number) => boolean;
  isCellActive: (col: number, row: number) => boolean;
  onCellMouseDown: (col: number, row: number, e: React.MouseEvent) => void;
  onCellMouseEnter: (col: number, row: number) => void;
  onCellDoubleClick: (col: number) => void;
  onGutterClick: (row: number, e: React.MouseEvent) => void;
  onCellChange: (rowIndex: number, columnId: string, value: unknown) => void;
  stopEditing: () => void;
  gutterColumn: boolean;
  rowActions?: RowAction[];
  readOnly: boolean;
  variant: DataGridVariant;
  // Navigation props
  activeCell: CellPosition | null;
  moveActiveCell: (
    direction: "up" | "down" | "left" | "right",
    extend?: boolean,
  ) => void;
  moveToRowStart: (extend?: boolean) => void;
  moveToRowEnd: (extend?: boolean) => void;
  moveToGridStart: (extend?: boolean) => void;
  moveToGridEnd: (extend?: boolean) => void;
  moveByPage: (
    direction: "up" | "down",
    pageSize: number,
    extend?: boolean,
  ) => void;
  selectRow: (rowIndex: number, extend?: boolean) => void;
  selectColumn: (colIndex: number) => void;
  selectAll: () => void;
  clearSelection: () => void;
  blurGrid: () => void;
};

export const Rows = forwardRef(function Rows<TData>(
  {
    table,
    columns,
    selection,
    isEditing,
    isCellSelected,
    isCellActive,
    onCellMouseDown,
    onCellMouseEnter,
    onCellDoubleClick,
    onGutterClick,
    onCellChange,
    stopEditing,
    gutterColumn,
    rowActions,
    readOnly,
    variant,
    activeCell,
    moveActiveCell,
    moveToRowStart,
    moveToRowEnd,
    moveToGridStart,
    moveToGridEnd,
    moveByPage,
    selectRow,
    selectColumn,
    selectAll,
    clearSelection,
    blurGrid,
  }: RowsProps<TData>,
  ref: React.ForwardedRef<RowsRef>,
) {
  const rows = table.getRowModel().rows;
  const colCount = columns.length;
  const visibleRowCount = rows.length;

  const handleKeyDown = useRowsNavigation({
    activeCell,
    colCount,
    isEditing,
    moveActiveCell,
    moveToRowStart,
    moveToRowEnd,
    moveToGridStart,
    moveToGridEnd,
    moveByPage,
    selectRow,
    selectColumn,
    selectAll,
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
              const cellSelected = isCellSelected(colIndex, rowIndex);

              return (
                <GridDataCell
                  key={cell.id}
                  cell={cell}
                  colIndex={colIndex}
                  rowIndex={rowIndex}
                  isSelected={cellSelected}
                  isActive={isCellActive(colIndex, rowIndex)}
                  isEditing={isEditing}
                  readOnly={readOnly}
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
