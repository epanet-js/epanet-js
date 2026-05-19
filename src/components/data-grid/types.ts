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

export type GridColumnMeta = {
  // Cell behavior — read by CellEditingFeature.column.isReadOnly()
  isReadOnly?: boolean | ((rowIndex: number) => boolean);
  // Delete key — read by CellEditingFeature.column.getDeleteValue()
  deleteValue?: unknown;
  // Cell rendering — read by CellRenderingFeature.column.getCellComponent()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cellComponent?: React.ComponentType<CellProps<any>>;
  // Clipboard — read by ClipboardFeature.column.getCopyValue()/getPasteValue()
  copyValue?: (value: unknown) => string;
  pasteValue?: (text: string) => unknown;
  // Auto-sizing — read by ColumnSizingFeature.column.getAutoSizeExtraWidth()/getPlaceholder()
  autoSizeExtraWidth?: number;
  placeholder?: string;
};

export type GridColumn = {
  // Required
  accessorKey: string;
  header: string;

  // Layout
  size?: number;
  minSize?: number;
  maxSize?: number;

  // Column behavior
  sortingFn?: GridSortingFn;

  // Grid-specific behaviour read via Column instance methods (ColumnMeta
  // augmentations). Being migrated here piecemeal; ultimately replaces the
  // top-level grid-specific fields above.
  meta?: GridColumnMeta;
};

export type DataGridVariant = "spreadsheet" | "inline";
