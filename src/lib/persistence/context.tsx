import { createContext, useContext } from "react";
import type { IPersistence } from "src/lib/persistence/ipersistence";

const notInContext = {} as IPersistence;

export const PersistenceContext = createContext<IPersistence>(notInContext);

export function usePersistence() {
  return useContext(PersistenceContext);
}
