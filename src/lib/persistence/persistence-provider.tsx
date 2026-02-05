import { useMemo, type ReactNode } from "react";
import type { Store } from "src/state/jotai";
import {
  PersistenceContext,
  PersistenceWithSnapshotsContext,
} from "src/lib/persistence/context";
import { Persistence } from "src/lib/persistence/persistence";

type Props = {
  store: Store;
  children: ReactNode;
};

export function PersistenceProvider({ store, children }: Props) {
  const persistence = useMemo(() => new Persistence(store), [store]);

  return (
    <PersistenceContext.Provider value={persistence}>
      <PersistenceWithSnapshotsContext.Provider value={persistence}>
        {children}
      </PersistenceWithSnapshotsContext.Provider>
    </PersistenceContext.Provider>
  );
}
