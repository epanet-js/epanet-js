import { IKeyValueStore } from "./types";

export class InMemoryKeyValueStore implements IKeyValueStore {
  private stores = new Map<string, Map<string, unknown>>();
  private keyPaths = new Map<string, string>();

  defineStore(name: string, keyPath: string): void {
    this.stores.set(name, new Map());
    this.keyPaths.set(name, keyPath);
  }

  private getStore(name: string): Map<string, unknown> {
    let store = this.stores.get(name);
    if (!store) {
      store = new Map();
      this.stores.set(name, store);
    }
    return store;
  }

  private resolveKey(storeName: string, value: unknown): string {
    const keyPath = this.keyPaths.get(storeName);
    if (keyPath && typeof value === "object" && value !== null) {
      return String((value as Record<string, unknown>)[keyPath]);
    }
    throw new Error(`Cannot resolve key for store "${storeName}"`);
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    return Promise.resolve([...this.getStore(storeName).values()] as T[]);
  }

  async get<T>(storeName: string, key: string): Promise<T | undefined> {
    return Promise.resolve(this.getStore(storeName).get(key) as T | undefined);
  }

  async put<T>(storeName: string, value: T): Promise<void> {
    const key = this.resolveKey(storeName, value);
    this.getStore(storeName).set(key, value);
    return Promise.resolve();
  }

  async delete(storeName: string, key: string): Promise<void> {
    this.getStore(storeName).delete(key);
    return Promise.resolve();
  }

  async batch(
    storeName: string,
    ops: Array<
      { type: "put"; value: unknown } | { type: "delete"; key: string }
    >,
  ): Promise<void> {
    for (const op of ops) {
      if (op.type === "put") {
        await this.put(storeName, op.value);
      } else {
        await this.delete(storeName, op.key);
      }
    }
  }
}
