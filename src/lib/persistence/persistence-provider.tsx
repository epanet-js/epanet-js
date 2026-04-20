import { useMemo, type ReactNode } from "react";
import type { Store } from "src/state";
import { PersistenceContext } from "src/lib/persistence/context";
import { Persistence } from "src/lib/persistence/persistence";

type Props = {
  store: Store;
  children: ReactNode;
};

export function PersistenceProvider({ store, children }: Props) {
  const persistence = useMemo(() => new Persistence(store), [store]);

  return (
    <PersistenceContext.Provider value={persistence}>
      {children}
    </PersistenceContext.Provider>
  );
}
