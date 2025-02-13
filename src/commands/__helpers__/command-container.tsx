import { QueryClient, QueryClientProvider } from "react-query";
import { Provider as JotaiProvider } from "jotai";
import { PersistenceContext } from "src/lib/persistence/context";
import { MemPersistence } from "src/lib/persistence/memory";
import { Dialogs } from "src/components/dialogs";
import { Store } from "src/state/jotai";
import { UIDMap } from "src/lib/id_mapper";
import Notifications from "src/components/notifications";

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
        <PersistenceContext.Provider value={new MemPersistence(idMap, store)}>
          <Dialogs></Dialogs>
          <Notifications duration={1} successDuration={1} />
          {children}
        </PersistenceContext.Provider>
      </JotaiProvider>
    </QueryClientProvider>
  );
};
