import { Cell } from "@tanstack/react-table";
import clsx from "clsx";
import { DataGridVariant, EditMode, GridColumn } from "../types";

export type SelectionEdge = {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
};

type GridDataCellProps<T> = {
  cell: Cell<T, unknown>;
  colIndex: number;
  rowIndex: number;
  isSelected: boolean;
  isActive: boolean;
  editMode: EditMode;
  isInteractive: boolean;
  readOnly: boolean;
  selectionEdge?: SelectionEdge;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onDoubleClick: () => void;
  onChange?: (value: unknown) => void;
  onBlur: () => void;
  onStartEditing: () => void;
  CellComponent: GridColumn["cellComponent"];
  variant: DataGridVariant;
  isLastRow: boolean;
};

export function GridDataCell<T>({
  cell,
  colIndex,
  rowIndex,
  isSelected,
  isActive,
  editMode,
  isInteractive,
  readOnly,
  selectionEdge,
  onMouseDown,
  onMouseEnter,
  onDoubleClick,
  onBlur,
  onStartEditing,
  onChange,
  CellComponent,
  variant,
  isLastRow,
}: GridDataCellProps<T>) {
  return (
    <div
      key={cell.id}
      role="gridcell"
      aria-colindex={colIndex + 1}
      aria-selected={isSelected}
      className={clsx(
        "relative h-8 grow select-none border cursor-cell",
        isActive
          ? "bg-white"
          : isSelected
            ? "bg-purple-300/10"
            : readOnly
              ? "bg-gray-50"
              : "bg-white",
        { "z-[1]": selectionEdge },
        selectionEdge?.left
          ? "border-l-purple-500"
          : variant === "spreadsheet"
            ? "border-l-gray-200"
            : "border-l-transparent",
        selectionEdge?.right ? "border-r-purple-500" : "border-r-transparent",
        selectionEdge?.top
          ? "border-t-purple-500"
          : variant === "rows" && rowIndex === 0
            ? "border-t-gray-200"
            : "border-t-transparent",
        selectionEdge?.bottom
          ? "border-b-purple-500"
          : variant === "rows" || (variant === "spreadsheet" && !isLastRow)
            ? "border-b-gray-200"
            : "border-b-transparent",
      )}
      style={{
        width: cell.column.getSize(),
        minWidth: cell.column.getSize(),
      }}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onDoubleClick={onDoubleClick}
    >
      {CellComponent ? (
        <CellComponent
          value={cell.getValue()}
          rowIndex={rowIndex}
          columnIndex={colIndex}
          isActive={isActive && isInteractive}
          editMode={isActive && isInteractive ? editMode : false}
          readOnly={readOnly}
          onChange={(newValue) => onChange?.(newValue)}
          stopEditing={onBlur}
          startEditing={onStartEditing}
        />
      ) : (
        <div className="w-full h-full flex items-center px-2 text-sm">
          {String(cell.getValue() ?? "")}
        </div>
      )}
    </div>
  );
}
