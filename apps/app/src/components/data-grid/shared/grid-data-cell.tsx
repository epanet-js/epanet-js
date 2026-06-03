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
  pinnedLeftOffset?: number;
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
  pinnedLeftOffset,
}: GridDataCellProps<TData>) {
  const colIndex = cell.column.getIndex();
  const isSelected = cell.isSelected();
  const isActive = cell.isActive();
  const isInteractive = cell.isInteractive();
  const editMode = cell.getEditMode();
  const selectionEdge = cell.getSelectionEdge();
  const CellComponent = cell.column.getCellComponent();
  // Pinned cells need solid backgrounds so non-pinned cells don't bleed
  // through when scrolled under; the selection tint is layered on top via
  // ::after so it matches the /10 alpha used elsewhere.
  const isPinnedLeft = cell.column.getIsPinned() === "left";
  return (
    <div
      key={cell.id}
      role="gridcell"
      aria-colindex={colIndex + 1}
      aria-selected={isSelected}
      className={clsx(
        "relative h-8 shrink-0 select-none border cursor-cell",
        { grow: !cell.column.getCanResize() },
        isPinnedLeft && "sticky z-5",
        isPinnedLeft &&
          isSelected &&
          !isActive &&
          "after:absolute after:inset-0 after:bg-purple-300/10 after:pointer-events-none",
        hasWarning
          ? "bg-warning-subtle"
          : readOnly
            ? "bg-panel"
            : isActive
              ? "bg-base"
              : isSelected
                ? isPinnedLeft
                  ? "bg-base"
                  : "bg-purple-300/10"
                : "bg-base",
        { "z-1": selectionEdge && !isPinnedLeft },
        selectionEdge?.left
          ? "border-l-accent"
          : variant === "spreadsheet"
            ? "border-l-[--color-border]"
            : "border-l-transparent",
        selectionEdge?.right
          ? "border-r-accent"
          : isPinnedLeft
            ? "border-r-[--color-border]"
            : isLastCol && cell.column.getCanResize()
              ? "border-r-[--color-border]"
              : "border-r-transparent",
        selectionEdge?.top
          ? "border-t-accent"
          : variant === "inline" && cell.row.getVisualIndex() === 0
            ? "border-t-[--color-border]"
            : "border-t-transparent",
        selectionEdge?.bottom
          ? "border-b-purple-500"
          : variant === "inline" || (variant === "spreadsheet" && !isLastRow)
            ? "border-b-[--color-border]"
            : "border-b-transparent",
      )}
      style={{
        width: cell.column.getSize(),
        minWidth: cell.column.getSize(),
        ...(isPinnedLeft ? { left: pinnedLeftOffset ?? 0 } : undefined),
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
        <div className="w-full h-full flex items-center px-2 text-size-base">
          {String(cell.getValue() ?? "")}
        </div>
      )}
    </div>
  );
}
