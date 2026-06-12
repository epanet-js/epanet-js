import { createContext, useContext } from "react";

export type GridBusyApi = {
  /**
   * Run a table operation (sort, bulk edit, …) as a low-priority transition: the
   * triggering event stays responsive, and the grid marks itself busy — blocking
   * further interaction — until the resulting render commits. Generic on purpose
   * so any operation that would interfere with others can opt in.
   */
  runBusy: (operation: () => void) => void;
};

// Default: no host provider (e.g. a bare grid) → run the operation inline.
const GridBusyContext = createContext<GridBusyApi>({
  runBusy: (operation) => operation(),
});

export const GridBusyProvider = GridBusyContext.Provider;

export const useGridBusy = (): GridBusyApi => useContext(GridBusyContext);
