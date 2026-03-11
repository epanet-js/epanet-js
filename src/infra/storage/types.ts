export interface IKeyBufferStore {
  save(key: string, data: ArrayBuffer): Promise<void>;

  readSlice(
    key: string,
    offset: number,
    length: number,
  ): Promise<ArrayBuffer | null>;

  readBlockSeries(
    key: string,
    baseOffset: number,
    readSize: number,
    blockSize: number,
    blockCount: number,
  ): Promise<ArrayBuffer>;

  getSize(key: string): Promise<number | null>;

  clear(): Promise<void>;
}

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
