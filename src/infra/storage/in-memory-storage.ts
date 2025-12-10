import { IPrivateAppStorage } from "./private-app-storage";

export class InMemoryStorage implements IPrivateAppStorage {
  private data = new Map<string, ArrayBuffer>();
  private heartbeatTimestamp: number | null = null;

  constructor(private readonly appId: string) {}

  save(key: string, data: ArrayBuffer): Promise<void> {
    this.data.set(key, data);
    this.heartbeatTimestamp = Date.now();
    return Promise.resolve();
  }

  readSlice(
    key: string,
    offset: number,
    length: number,
  ): Promise<ArrayBuffer | null> {
    const data = this.data.get(key);
    if (!data) return Promise.resolve(null);
    this.heartbeatTimestamp = Date.now();
    return Promise.resolve(data.slice(offset, offset + length));
  }

  read(key: string): Promise<ArrayBuffer | null> {
    const data = this.data.get(key);
    if (!data) return Promise.resolve(null);
    this.heartbeatTimestamp = Date.now();
    return Promise.resolve(data);
  }

  clear(): Promise<void> {
    this.data.clear();
    this.heartbeatTimestamp = null;
    return Promise.resolve();
  }

  updateHeartbeat(): Promise<void> {
    this.heartbeatTimestamp = Date.now();
    return Promise.resolve();
  }

  // Test helpers

  getAppId(): string {
    return this.appId;
  }

  getHeartbeatTimestamp(): number | null {
    return this.heartbeatTimestamp;
  }

  has(key: string): boolean {
    return this.data.has(key);
  }

  getCount(): number {
    return this.data.size;
  }
}
