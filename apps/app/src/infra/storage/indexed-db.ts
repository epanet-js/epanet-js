import { IKeyValueStore } from "./types";

type Migration = (db: IDBDatabase, transaction: IDBTransaction) => void;

export interface IDBSchema {
  name: string;
  version: number;
  migrations: Record<number, Migration>;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openRaw(schema: IDBSchema): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(schema.name, schema.version);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const tx = request.transaction!;
      const oldVersion = event.oldVersion;
      for (let v = oldVersion + 1; v <= schema.version; v++) {
        const migration = schema.migrations[v];
        if (migration) migration(db, tx);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class IndexedDB implements IKeyValueStore {
  private schema: IDBSchema;

  constructor(schema: IDBSchema) {
    this.schema = schema;
  }

  private async open(): Promise<IDBDatabase> {
    return openRaw(this.schema);
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    const db = await this.open();
    const store = db.transaction(storeName, "readonly").objectStore(storeName);
    const result = await requestToPromise<T[]>(store.getAll());
    db.close();
    return result;
  }

  async get<T>(storeName: string, key: string): Promise<T | undefined> {
    const db = await this.open();
    const store = db.transaction(storeName, "readonly").objectStore(storeName);
    const result = await requestToPromise<T | undefined>(store.get(key));
    db.close();
    return result;
  }

  async put<T>(storeName: string, value: T): Promise<void> {
    const db = await this.open();
    const store = db.transaction(storeName, "readwrite").objectStore(storeName);
    await requestToPromise(store.put(value));
    db.close();
  }

  async delete(storeName: string, key: string): Promise<void> {
    const db = await this.open();
    const store = db.transaction(storeName, "readwrite").objectStore(storeName);
    await requestToPromise(store.delete(key));
    db.close();
  }

  async batch(
    storeName: string,
    ops: Array<
      { type: "put"; value: unknown } | { type: "delete"; key: string }
    >,
  ): Promise<void> {
    if (ops.length === 0) return;
    const db = await this.open();
    const store = db.transaction(storeName, "readwrite").objectStore(storeName);
    for (const op of ops) {
      if (op.type === "put") {
        await requestToPromise(store.put(op.value));
      } else {
        await requestToPromise(store.delete(op.key));
      }
    }
    db.close();
  }
}
