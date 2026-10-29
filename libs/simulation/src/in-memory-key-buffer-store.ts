import { IKeyBufferStore, ISyncKeyBufferReader } from "./results-store";

// Shared storage across all InMemoryStorage instances (keyed by appId)
const sharedStorage = new Map<string, Map<string, ArrayBuffer>>();

export class InMemoryKeyBufferStore
  implements IKeyBufferStore, ISyncKeyBufferReader
{
  constructor(private readonly appId: string) {
    if (!sharedStorage.has(appId)) {
      sharedStorage.set(appId, new Map());
    }
  }

  private get data(): Map<string, ArrayBuffer> {
    return sharedStorage.get(this.appId)!;
  }

  save(key: string, data: ArrayBuffer): Promise<void> {
    this.data.set(key, data);
    return Promise.resolve();
  }

  readSlice(key: string, offset: number, length: number): Promise<ArrayBuffer> {
    return Promise.resolve(this.readSliceSync(key, offset, length));
  }

  readSliceSync(key: string, offset: number, length: number): ArrayBuffer {
    const data = this.data.get(key);
    if (!data) throw new Error(`Key "${key}" not found in storage`);
    return data.slice(offset, offset + length);
  }

  readBlockSeries(
    key: string,
    baseOffset: number,
    readSize: number,
    blockSize: number,
    blockCount: number,
  ): Promise<ArrayBuffer> {
    return Promise.resolve(
      this.readBlockSeriesSync(
        key,
        baseOffset,
        readSize,
        blockSize,
        blockCount,
      ),
    );
  }

  readBlockSeriesSync(
    key: string,
    baseOffset: number,
    readSize: number,
    blockSize: number,
    blockCount: number,
  ): ArrayBuffer {
    if (blockCount === 0) return new ArrayBuffer(0);

    const data = this.data.get(key);
    if (!data) throw new Error(`Key "${key}" not found in storage`);

    const result = new ArrayBuffer(readSize * blockCount);
    const dst = new Uint8Array(result);
    const src = new Uint8Array(data);

    for (let i = 0; i < blockCount; i++) {
      const offset = baseOffset + i * blockSize;
      dst.set(src.subarray(offset, offset + readSize), i * readSize);
    }

    return result;
  }

  getFile(key: string): Promise<File> {
    const data = this.data.get(key);
    if (!data) throw new Error(`Key "${key}" not found in storage`);
    return Promise.resolve(new File([data], key));
  }

  getSize(key: string): Promise<number> {
    const data = this.data.get(key);
    if (!data) throw new Error(`Key "${key}" not found in storage`);
    return Promise.resolve(data.byteLength);
  }

  clear(): Promise<void> {
    this.data.clear();
    return Promise.resolve();
  }

  clearRun(): Promise<void> {
    return Promise.resolve();
  }

  // Test helpers

  getAppId(): string {
    return this.appId;
  }

  has(key: string): boolean {
    return this.data.has(key);
  }

  getCount(): number {
    return this.data.size;
  }

  // Static test helper to reset all shared storage between tests
  static resetAll(): void {
    sharedStorage.clear();
  }
}
