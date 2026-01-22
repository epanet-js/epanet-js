import { CellContext, ColumnDef } from "@tanstack/react-table";

// Selection types (compatible with react-datasheet-grid)
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

// Row action type (compatible with existing API)
export type RowAction = {
  label: string;
  icon: React.ReactNode;
  onSelect: (rowIndex: number) => void;
  disabled?: (rowIndex: number) => boolean;
};

// Column definition for spreadsheet cells
export type SpreadsheetColumnMeta<TValue = unknown> = {
  // Cell rendering
  cellComponent?: React.ComponentType<SpreadsheetCellProps<TValue>>;
  // Copy/paste handlers
  copyValue?: (value: TValue) => string;
  pasteValue?: (value: string) => TValue;
  deleteValue?: TValue | (() => TValue);
  // Column behavior
  disabled?: boolean;
  disableKeys?: boolean;
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

// Extended column def with spreadsheet metadata
export type SpreadsheetColumnDef<TData, TValue = unknown> = ColumnDef<
  TData,
  TValue
> & {
  meta?: SpreadsheetColumnMeta<TValue>;
};

// Context for cell components
export type SpreadsheetContextValue = {
  setActiveCell: (cell: CellPosition) => void;
};

// Ref type for programmatic control
export type SpreadsheetTableRef = {
  setActiveCell: (cell: CellPosition) => void;
  setSelection: (selection: SpreadsheetSelection | null) => void;
  selection: SpreadsheetSelection | null;
};

// Main component props (compatible with existing API)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SpreadsheetTableProps<TData extends Record<string, unknown>> = {
  data: TData[];
  // Using any for columns to allow flexible column definitions from keyColumn helper
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: any[];
  onChange: (data: TData[]) => void;
  createRow: () => TData;
  lockRows?: boolean;
  emptyState?: React.ReactNode;
  rowActions?: RowAction[];
  addRowLabel?: string;
  gutterColumn?: boolean;
  onSelectionChange?: (selection: SpreadsheetSelection | null) => void;
};

// Helper to get typed cell context
export type TypedCellContext<TData, TValue> = CellContext<TData, TValue>;
