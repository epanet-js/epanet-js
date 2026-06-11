import type { ColumnDef, RowData } from "@tanstack/react-table";

export type GridColumn<TData extends RowData = RowData> = ColumnDef<
  TData,
  unknown
>;

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
  onSelect: (
    selection: GridSelection,
    sortedRows: TData[],
    originCell: CellPosition,
  ) => void;
  disabled?: (selection: GridSelection) => boolean;
  variant?: ContextActionVariant;
};

export type GutterContextAction<TData = unknown> = {
  label: string;
  icon: React.ReactNode;
  onSelect: (
    selection: GridSelection,
    sortedRows: TData[],
    originRowIndex: number,
  ) => void;
  disabled?: (rowIndex: number) => boolean;
  variant?: ContextActionVariant;
};

export type CellProps<TValue = unknown> = {
  value: TValue;
  row: unknown;
  rowIndex: number;
  columnIndex: number;
  isActive: boolean;
  editMode: EditMode;
  readOnly: boolean;
  onChange: (newValue: TValue) => void;
  stopEditing: () => void;
  startEditing: (mode?: "quick" | "full") => void;
};

export type DataGridVariant = "spreadsheet" | "inline";
