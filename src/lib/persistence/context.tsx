import { createContext, useContext } from "react";
import type {
  IPersistence,
  IPersistenceWithSnapshots,
} from "src/lib/persistence/ipersistence";

const notInContext = {} as IPersistence;
const notInContextWithSnapshots = {} as IPersistenceWithSnapshots;

export const PersistenceContext = createContext<IPersistence>(notInContext);
export const PersistenceWithSnapshotsContext =
  createContext<IPersistenceWithSnapshots>(notInContextWithSnapshots);

export function usePersistence(): IPersistence {
  return useContext(PersistenceContext);
}

export function usePersistenceWithSnapshots(): IPersistenceWithSnapshots {
  return useContext(PersistenceWithSnapshotsContext);
}
