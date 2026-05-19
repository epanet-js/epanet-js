export type CellPosition = { col: number; row: number };

export type GridSelection = {
  min: CellPosition;
  max: CellPosition;
};

export type EditMode = false | "quick" | "full";

export type RowAction = {
  label: string;
  icon: React.ReactNode;
  onSelect: (rowIndex: number) => void;
  disabled?: (rowIndex: number) => boolean;
};

export type ContextActionVariant = "default" | "destructive";

export type CellContextAction<TData = unknown> = {
  label: string;
  icon: React.ReactNode;
  onSelect: (selection: GridSelection, sortedRows: TData[]) => void;
  disabled?: (selection: GridSelection) => boolean;
  variant?: ContextActionVariant;
};

export type GutterContextAction<TData = unknown> = {
  label: string;
  icon: React.ReactNode;
  onSelect: (selection: GridSelection, sortedRows: TData[]) => void;
  disabled?: (rowIndex: number) => boolean;
  variant?: ContextActionVariant;
};

export type CellProps<TValue = unknown> = {
  value: TValue;
  rowIndex: number;
  columnIndex: number;
  isActive: boolean;
  editMode: EditMode;
  readOnly: boolean;
  onChange: (newValue: TValue) => void;
  stopEditing: () => void;
  startEditing: (mode?: "quick" | "full") => void;
};

export type GridSortingFn =
  | "auto"
  | "alphanumeric"
  | "text"
  | "basic"
  | ((
      rowA: { getValue: (id: string) => unknown },
      rowB: { getValue: (id: string) => unknown },
      columnId: string,
    ) => number);

export type GridColumn = {
  // Required
  accessorKey: string;
  header: string;

  // Layout
  size?: number;
  minSize?: number;
  maxSize?: number;
  // Extra px to add to canvas-measured text width when auto-sizing. Defaults to 16px
  autoSizeExtraWidth?: number;
  // Text shown when the cell value is null/empty; used when auto-sizing the column
  placeholder?: string;

  // Cell rendering
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cellComponent?: React.ComponentType<CellProps<any>>;

  // Copy/paste/delete behavior
  copyValue?: (value: unknown) => string;
  pasteValue?: (value: string) => unknown;
  deleteValue?: unknown;

  // Column behavior
  isReadOnly?: boolean | ((rowIndex: number) => boolean);
  sortingFn?: GridSortingFn;
};

export function isColumnReadOnly(
  column: GridColumn | undefined,
  rowIndex: number,
): boolean {
  const flag = column?.isReadOnly;
  if (typeof flag === "function") return flag(rowIndex);
  return !!flag;
}

export type DataGridVariant = "spreadsheet" | "inline";
