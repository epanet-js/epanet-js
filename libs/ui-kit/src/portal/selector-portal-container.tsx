import { createContext, useContext } from "react";

const SelectorPortalContext = createContext<HTMLElement | null>(null);

export function SelectorPortalContainer({
  container,
  children,
}: {
  container: HTMLElement | null;
  children: React.ReactNode;
}) {
  return (
    <SelectorPortalContext.Provider value={container}>
      {children}
    </SelectorPortalContext.Provider>
  );
}

export function useSelectorPortalContainer(): HTMLElement | null {
  return useContext(SelectorPortalContext);
}
