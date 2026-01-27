export type CellPosition = { col: number; row: number };

export type SpreadsheetSelection = {
  min: CellPosition;
  max: CellPosition;
};

export type SelectionState = {
  activeCell: CellPosition | null;
  anchor: CellPosition | null;
  isEditing: boolean;
};

// Row action type for dropdown actions column
export type RowAction = {
  label: string;
  icon: React.ReactNode;
  onSelect: (rowIndex: number) => void;
  disabled?: (rowIndex: number) => boolean;
};

// Props passed to custom cell components
export type SpreadsheetCellProps<TValue = unknown> = {
  value: TValue;
  rowIndex: number;
  columnIndex: number;
  isActive: boolean;
  isEditing: boolean;
  isSelected: boolean;
  onChange: (newValue: TValue) => void;
  stopEditing: () => void;
  focus: boolean;
};

// Column definition - simple flat structure
export type SpreadsheetColumn = {
  // Required
  accessorKey: string;
  header: string;

  // Layout
  size?: number;

  // Cell rendering
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cellComponent?: React.ComponentType<SpreadsheetCellProps<any>>;

  // Copy/paste/delete behavior
  copyValue?: (value: unknown) => string;
  pasteValue?: (value: string) => unknown;
  deleteValue?: unknown;

  // Column behavior
  disabled?: boolean;
  disableKeys?: boolean;
};

// Ref type for programmatic control
export type SpreadsheetTableRef = {
  setActiveCell: (cell: CellPosition) => void;
  setSelection: (selection: SpreadsheetSelection | null) => void;
  selection: SpreadsheetSelection | null;
};

// Main component props
export type SpreadsheetTableProps<TData extends Record<string, unknown>> = {
  data: TData[];
  columns: SpreadsheetColumn[];
  onChange: (data: TData[]) => void;
  createRow: () => TData;
  lockRows?: boolean;
  emptyState?: React.ReactNode;
  rowActions?: RowAction[];
  addRowLabel?: string;
  gutterColumn?: boolean;
  onSelectionChange?: (selection: SpreadsheetSelection | null) => void;
};

// Context for cell components
export type SpreadsheetContextValue = {
  setActiveCell: (cell: CellPosition) => void;
};
