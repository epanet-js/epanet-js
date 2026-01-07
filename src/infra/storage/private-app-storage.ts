export interface IPrivateAppStorage {
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
