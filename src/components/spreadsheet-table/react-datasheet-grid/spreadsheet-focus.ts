// Global flag to track if any spreadsheet has an active selection.
// This is needed because react-datasheet-grid doesn't move DOM focus,
// it manages selection state internally.

let isSpreadsheetActive = false;

export const setSpreadsheetActive = (active: boolean) => {
  isSpreadsheetActive = active;
};

export const hasActiveSpreadsheet = () => isSpreadsheetActive;
