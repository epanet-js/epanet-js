import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider } from "jotai";
import { PersistenceContext } from "src/lib/persistence/context";
import { MemPersistence } from "src/lib/persistence/memory";
import { Dialogs } from "src/components/dialogs";
import { Store } from "src/state/jotai";
import { UIDMap } from "src/lib/id-mapper";
import Notifications from "src/components/notifications";
import { LocaleProvider } from "src/hooks/use-locale";

export const CommandContainer = ({
  store,
  children,
}: {
  store: Store;
  children: React.ReactNode;
}) => {
  const idMap = UIDMap.empty();
  return (
    <QueryClientProvider client={new QueryClient()}>
      <JotaiProvider store={store}>
        <LocaleProvider>
          <PersistenceContext.Provider value={new MemPersistence(idMap, store)}>
            <Dialogs></Dialogs>
            <Notifications duration={1} successDuration={1} />
            {children}
          </PersistenceContext.Provider>
        </LocaleProvider>
      </JotaiProvider>
    </QueryClientProvider>
  );
};
