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

  getSize(key: string): Promise<number | null> {
    const data = this.data.get(key);
    if (!data) return Promise.resolve(null);
    return Promise.resolve(data.byteLength);
  }

  clear(): Promise<void> {
    this.data.clear();
    return Promise.resolve();
  }

  updateHeartbeat(): Promise<void> {
    // No-op for in-memory storage (heartbeat is only needed for OPFS cleanup)
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
