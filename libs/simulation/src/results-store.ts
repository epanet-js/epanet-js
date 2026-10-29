export interface IKeyBufferStore {
  save(key: string, data: ArrayBuffer): Promise<void>;

  readSlice(key: string, offset: number, length: number): Promise<ArrayBuffer>;

  readBlockSeries(
    key: string,
    baseOffset: number,
    readSize: number,
    blockSize: number,
    blockCount: number,
  ): Promise<ArrayBuffer>;

  getFile(key: string): Promise<File>;

  getSize(key: string): Promise<number>;

  clear(): Promise<void>;

  clearRun(): Promise<void>;
}

export interface ISyncKeyBufferReader {
  readSliceSync(key: string, offset: number, length: number): ArrayBuffer;

  readBlockSeriesSync(
    key: string,
    baseOffset: number,
    readSize: number,
    blockSize: number,
    blockCount: number,
  ): ArrayBuffer;
}

export const RESULTS_OUT_KEY = "results.out";
export const TANK_VOLUMES_KEY = "tank-volumes.bin";
export const PUMP_STATUS_KEY = "pump-status.bin";
export const NODE_STATS_KEY = "node_stats.bin";
