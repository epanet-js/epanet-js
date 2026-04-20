import type { IPersistence } from "src/lib/persistence/ipersistence";
import { Store } from "src/state";

export class Persistence implements IPersistence {
  constructor(_store: Store) {}
}
