export type { IKeyBufferStore } from "@epanet-js/simulation";

export interface IKeyValueStore {
  getAll<T>(storeName: string): Promise<T[]>;
  get<T>(storeName: string, key: string): Promise<T | undefined>;
  put<T>(storeName: string, value: T): Promise<void>;
  delete(storeName: string, key: string): Promise<void>;
  batch(
    storeName: string,
    ops: Array<
      { type: "put"; value: unknown } | { type: "delete"; key: string }
    >,
  ): Promise<void>;
}
