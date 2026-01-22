// Global flag to track if any spreadsheet has an active selection.
// Used by keyboard shortcuts to avoid conflicts.

let isSpreadsheetActive = false;

export const setSpreadsheetActive = (active: boolean) => {
  isSpreadsheetActive = active;
};

export const hasActiveSpreadsheet = () => isSpreadsheetActive;
