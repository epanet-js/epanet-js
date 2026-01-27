import { useMemo, type ReactNode } from "react";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import type { Store } from "src/state/jotai";
import {
  PersistenceContext,
  PersistenceWithSnapshotsContext,
} from "src/lib/persistence/context";
import { MemPersistenceDeprecated } from "src/lib/persistence/memory-deprecated";
import { Persistence } from "src/lib/persistence/persistence";

type Props = {
  store: Store;
  children: ReactNode;
};

export function PersistenceProvider({ store, children }: Props) {
  const isScenariosOn = useFeatureFlag("FLAG_SCENARIOS");

  const deprecatedPersistence = useMemo(
    () => new MemPersistenceDeprecated(store),
    [store],
  );

  const newPersistence = useMemo(() => {
    if (isScenariosOn) {
      return new Persistence(store);
    }
    return null;
  }, [store, isScenariosOn]);

  const mainPersistence = newPersistence ?? deprecatedPersistence;

  return (
    <PersistenceContext.Provider value={mainPersistence}>
      <PersistenceWithSnapshotsContext.Provider
        value={newPersistence ?? deprecatedPersistence}
      >
        {children}
      </PersistenceWithSnapshotsContext.Provider>
    </PersistenceContext.Provider>
  );
}
