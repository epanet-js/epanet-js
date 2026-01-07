import { IPrivateAppStorage } from "./private-app-storage";

// Shared storage across all InMemoryStorage instances (keyed by appId)
const sharedStorage = new Map<string, Map<string, ArrayBuffer>>();

export class InMemoryStorage implements IPrivateAppStorage {
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

  readSlice(
    key: string,
    offset: number,
    length: number,
  ): Promise<ArrayBuffer | null> {
    const data = this.data.get(key);
    if (!data) return Promise.resolve(null);
    return Promise.resolve(data.slice(offset, offset + length));
  }

  async readBlockSeries(
    key: string,
    baseOffset: number,
    readSize: number,
    blockSize: number,
    blockCount: number,
  ): Promise<ArrayBuffer> {
    const result = new ArrayBuffer(readSize * blockCount);
    const resultView = new Uint8Array(result);
    const BATCH_SIZE = 50;

    for (let batch = 0; batch < Math.ceil(blockCount / BATCH_SIZE); batch++) {
      const startIdx = batch * BATCH_SIZE;
      const endIdx = Math.min(startIdx + BATCH_SIZE, blockCount);

      const readPromises = [];
      for (let i = startIdx; i < endIdx; i++) {
        const offset = baseOffset + i * blockSize;
        readPromises.push(this.readSlice(key, offset, readSize));
      }

      const results = await Promise.all(readPromises);
      for (let i = 0; i < results.length; i++) {
        const data = results[i];
        if (data) {
          resultView.set(new Uint8Array(data), (startIdx + i) * readSize);
        }
      }
    }

    return result;
  }

  getSize(key: string): Promise<number | null> {
    const data = this.data.get(key);
    if (!data) return Promise.resolve(null);
    return Promise.resolve(data.byteLength);
  }

  clear(): Promise<void> {
    this.data.clear();
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
