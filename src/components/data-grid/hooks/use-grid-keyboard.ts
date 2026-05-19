import { ForwardedRef, useImperativeHandle } from "react";
import { Table } from "@tanstack/react-table";
import { GridRef } from "../shared/types";
import { useRowsNavigation } from "./use-rows-navigation";

type Options<TData extends Record<string, unknown>> = {
  ref: ForwardedRef<GridRef>;
  table: Table<TData>;
  selectCells: (options?: {
    colIndex?: number;
    rowIndex?: number;
    extend?: boolean;
  }) => void;
  clearSelection: () => void;
  blurGrid: () => void;
  visibleRowCount: number;
};

export function useGridKeyboard<TData extends Record<string, unknown>>({
  ref,
  table,
  selectCells,
  clearSelection,
  blurGrid,
  visibleRowCount,
}: Options<TData>) {
  const handleKeyDown = useRowsNavigation({
    activeCell: table.getActiveCell(),
    rowCount: table.getRowModel().rows.length,
    colCount: table.getVisibleLeafColumns().length,
    editMode: table.getEditMode(),
    selectCells,
    clearSelection,
    blurGrid,
    visibleRowCount,
  });

  useImperativeHandle(ref, () => ({ handleKeyDown }), [handleKeyDown]);
}
