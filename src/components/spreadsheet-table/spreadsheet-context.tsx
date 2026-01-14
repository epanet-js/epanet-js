import { createContext, useContext } from "react";

type SpreadsheetContextValue = {
  setActiveCell: (cell: { col: number; row: number }) => void;
};

const SpreadsheetContext = createContext<SpreadsheetContextValue | null>(null);

export const SpreadsheetProvider = SpreadsheetContext.Provider;

export const useSpreadsheetContext = () => {
  const context = useContext(SpreadsheetContext);
  if (!context) {
    throw new Error(
      "useSpreadsheetContext must be used within SpreadsheetProvider",
    );
  }
  return context;
};
