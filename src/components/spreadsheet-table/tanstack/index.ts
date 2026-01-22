// Main component
export { SpreadsheetTable } from "./spreadsheet-table";

// Types
export type {
  SpreadsheetTableRef,
  SpreadsheetSelection,
  SpreadsheetTableProps,
  SpreadsheetColumnDef,
  RowAction,
  CellPosition,
} from "./types";

// Column helpers (for backwards compatibility with react-datasheet-grid API)
export { keyColumn, type Column } from "./column-helpers";

// Column creators
export { createFloatColumn } from "./cells/float-cell";
export { createSelectColumn } from "./cells/select-cell";
export { createFilterableSelectColumn } from "./cells/filterable-select-cell";
export { createTextReadonlyColumn } from "./cells/text-readonly-cell";

// Focus management
export { hasActiveSpreadsheet } from "./spreadsheet-focus";

// Re-export SpreadsheetTableRef as DataSheetGridRef for backwards compatibility
export type { SpreadsheetTableRef as DataSheetGridRef } from "./types";
