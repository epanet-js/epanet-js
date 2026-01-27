import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider } from "jotai";
import { PersistenceProvider } from "src/lib/persistence";
import { Dialogs } from "src/components/dialogs";
import { Store } from "src/state/jotai";
import Notifications from "src/components/notifications";

export const CommandContainer = ({
  store,
  children,
}: {
  store: Store;
  children: React.ReactNode;
}) => {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <JotaiProvider store={store}>
        <PersistenceProvider store={store}>
          <Dialogs></Dialogs>
          <Notifications duration={1} successDuration={1} />
          {children}
        </PersistenceProvider>
      </JotaiProvider>
    </QueryClientProvider>
  );
};
