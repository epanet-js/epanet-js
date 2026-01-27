// Legacy implementation (react-datasheet-grid)
export {
  SpreadsheetTableLegacy,
  createSelectColumnLegacy,
  createFloatColumnLegacy,
  createTextReadonlyColumnLegacy,
  createFilterableSelectColumnLegacy,
  hasActiveSpreadsheet,
} from "./react-datasheet-grid";
export type {
  SpreadsheetTableRefLegacy,
  SpreadsheetSelectionLegacy,
  RowActionLegacy,
} from "./react-datasheet-grid";

// TanStack implementation (new)
export {
  SpreadsheetTable,
  floatColumn,
  selectColumn,
  filterableSelectColumn,
  textReadonlyColumn,
} from "./tanstack";
export type {
  SpreadsheetTableRef,
  SpreadsheetSelection,
  SpreadsheetColumn,
  RowAction,
  CellPosition,
} from "./tanstack";
