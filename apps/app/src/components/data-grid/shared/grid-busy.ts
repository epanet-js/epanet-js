import { createContext, useContext } from "react";

export type GridBusyApi = {
  runBusy: (operation: () => void) => void;
  runBusyAsync: (operation: () => Promise<void> | void) => void;
};

const GridBusyContext = createContext<GridBusyApi>({
  runBusy: (operation) => operation(),
  runBusyAsync: (operation) => void operation(),
});

export const GridBusyProvider = GridBusyContext.Provider;

export const useGridBusy = (): GridBusyApi => useContext(GridBusyContext);
