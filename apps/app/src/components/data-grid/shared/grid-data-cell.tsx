import { Cell } from "@tanstack/react-table";
import clsx from "clsx";
import { DataGridVariant } from "../types";

type GridDataCellProps<TData extends Record<string, unknown>> = {
  cell: Cell<TData, unknown>;
  readOnly: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onDoubleClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onChange?: (value: unknown) => void;
  onBlur: () => void;
  onStartEditing: () => void;
  variant: DataGridVariant;
  isLastRow: boolean;
  isLastCol: boolean;
  hasWarning?: boolean;
};

export function GridDataCell<TData extends Record<string, unknown>>({
  cell,
  readOnly,
  onMouseDown,
  onMouseEnter,
  onDoubleClick,
  onContextMenu,
  onBlur,
  onStartEditing,
  onChange,
  variant,
  isLastRow,
  isLastCol,
  hasWarning,
}: GridDataCellProps<TData>) {
  const colIndex = cell.column.getIndex();
  const isSelected = cell.isSelected();
  const isActive = cell.isActive();
  const isInteractive = cell.isInteractive();
  const editMode = cell.getEditMode();
  const selectionEdge = cell.getSelectionEdge();
  const CellComponent = cell.column.getCellComponent();
  return (
    <div
      key={cell.id}
      role="gridcell"
      aria-colindex={colIndex + 1}
      aria-selected={isSelected}
      className={clsx(
        "relative h-8 shrink-0 select-none border cursor-cell",
        { grow: !cell.column.getCanResize() },
        hasWarning
          ? "bg-orange-50"
          : readOnly
            ? "bg-gray-50"
            : isActive
              ? "bg-white"
              : isSelected
                ? "bg-purple-300/10"
                : "bg-white",
        { "z-1": selectionEdge },
        selectionEdge?.left
          ? "border-l-purple-500"
          : variant === "spreadsheet"
            ? "border-l-gray-200"
            : "border-l-transparent",
        selectionEdge?.right
          ? "border-r-purple-500"
          : isLastCol && cell.column.getCanResize()
            ? "border-r-gray-200"
            : "border-r-transparent",
        selectionEdge?.top
          ? "border-t-purple-500"
          : variant === "inline" && cell.row.getVisualIndex() === 0
            ? "border-t-gray-200"
            : "border-t-transparent",
        selectionEdge?.bottom
          ? "border-b-purple-500"
          : variant === "inline" || (variant === "spreadsheet" && !isLastRow)
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
      onContextMenu={onContextMenu}
    >
      {CellComponent ? (
        <CellComponent
          value={cell.getValue()}
          rowIndex={cell.row.index}
          columnIndex={cell.column.getIndex()}
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
