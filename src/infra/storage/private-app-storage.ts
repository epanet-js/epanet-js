export interface IPrivateAppStorage {
  save(key: string, data: ArrayBuffer): Promise<void>;

  readSlice(
    key: string,
    offset: number,
    length: number,
  ): Promise<ArrayBuffer | null>;

  read(key: string): Promise<ArrayBuffer | null>;

  clear(): Promise<void>;

  updateHeartbeat(): Promise<void>;
}
