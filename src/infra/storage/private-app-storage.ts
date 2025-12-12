export interface IPrivateAppStorage {
  save(key: string, data: ArrayBuffer): Promise<void>;

  readSlice(
    key: string,
    offset: number,
    length: number,
  ): Promise<ArrayBuffer | null>;

  getSize(key: string): Promise<number | null>;

  clear(): Promise<void>;
}
