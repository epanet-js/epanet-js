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
import { useRowsNavigation } from "../hooks";
import { GridRow } from "./grid-row";

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
  cellHasWarning?: (rowIndex: number, columnId: string) => boolean;
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
    cellHasWarning,
  }: RowsProps<TData>,
  ref: React.ForwardedRef<RowsRef>,
) {
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
              onGutterClick={onGutterClick}
              onCellChange={onCellChange}
              stopEditing={stopEditing}
              startEditing={startEditing}
              gutterColumn={gutterColumn}
              gutterIsLastRow={isLast}
              cellsIsLastRow={isLast}
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
}) as <TData>(
  props: RowsProps<TData> & { ref?: React.Ref<RowsRef> },
) => React.ReactElement;
