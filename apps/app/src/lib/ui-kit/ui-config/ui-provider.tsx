import { createContext, useContext, useMemo } from "react";

export type UIConfig = {
  searchPlaceholder: string;
  selectorAddNewValueTemplate: string;
  noResultsLabel: string;
};

const defaultUIConfig: UIConfig = {
  searchPlaceholder: "Search…",
  selectorAddNewValueTemplate: 'Add "{{1}}"',
  noResultsLabel: "No results",
};

const UIConfigContext = createContext<UIConfig>(defaultUIConfig);

export function UIProvider({
  config,
  children,
}: {
  config?: Partial<UIConfig>;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ ...defaultUIConfig, ...config }), [config]);
  return (
    <UIConfigContext.Provider value={value}>
      {children}
    </UIConfigContext.Provider>
  );
}

export function useUIConfig(): UIConfig {
  return useContext(UIConfigContext);
}
