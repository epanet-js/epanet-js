export type CellPosition = { col: number; row: number };

export type GridSelection = {
  min: CellPosition;
  max: CellPosition;
};

export type SelectionState = {
  activeCell: CellPosition | null;
  anchor: CellPosition | null;
  isEditing: boolean;
};

export type RowAction = {
  label: string;
  icon: React.ReactNode;
  onSelect: (rowIndex: number) => void;
  disabled?: (rowIndex: number) => boolean;
};

export type CellProps<TValue = unknown> = {
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

export type GridColumn = {
  // Required
  accessorKey: string;
  header: string;

  // Layout
  size?: number;

  // Cell rendering
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cellComponent?: React.ComponentType<CellProps<any>>;

  // Copy/paste/delete behavior
  copyValue?: (value: unknown) => string;
  pasteValue?: (value: string) => unknown;
  deleteValue?: unknown;

  // Column behavior
  disabled?: boolean;
  disableKeys?: boolean;
};

export type DataGridRef = {
  setActiveCell: (cell: CellPosition) => void;
  setSelection: (selection: GridSelection | null) => void;
  selection: GridSelection | null;
};

export type CellContext = {
  setActiveCell: (cell: CellPosition) => void;
};

export type DataGridVariant = "spreadsheet" | "rows";
