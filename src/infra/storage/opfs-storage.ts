import { IPrivateAppStorage } from "./private-app-storage";

const ROOT_DIR = "epanet-simulation";
const HEARTBEAT_FILE = "heartbeat.json";

export class OPFSStorage implements IPrivateAppStorage {
  constructor(private readonly appId: string) {}

  async save(filename: string, data: ArrayBuffer): Promise<void> {
    const dir = await this.getAppDir();
    const fileHandle = await dir.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(data);
    await writable.close();
    await this.updateHeartbeat();
  }

  async readSlice(
    filename: string,
    offset: number,
    length: number,
  ): Promise<ArrayBuffer | null> {
    try {
      const dir = await this.getAppDir();
      const fileHandle = await dir.getFileHandle(filename);
      const file = await fileHandle.getFile();
      const slice = file.slice(offset, offset + length);
      const result = await slice.arrayBuffer();
      await this.updateHeartbeat();
      return result;
    } catch {
      return null;
    }
  }

  async getSize(filename: string): Promise<number | null> {
    try {
      const dir = await this.getAppDir();
      const fileHandle = await dir.getFileHandle(filename);
      const file = await fileHandle.getFile();
      return file.size;
    } catch {
      return null;
    }
  }

  async clear(): Promise<void> {
    try {
      const root = await this.getRootDir();
      await root.removeEntry(this.appId, { recursive: true });
    } catch {
      // Directory may not exist
    }
  }

  async updateHeartbeat(): Promise<void> {
    const dir = await this.getAppDir();
    const fileHandle = await dir.getFileHandle(HEARTBEAT_FILE, {
      create: true,
    });
    const writable = await fileHandle.createWritable();
    const data = JSON.stringify({ timestamp: Date.now() });
    await writable.write(data);
    await writable.close();
  }

  static async cleanupStale(thresholdMs: number): Promise<void> {
    try {
      const root = await navigator.storage.getDirectory();
      const simulationDir = await root.getDirectoryHandle(ROOT_DIR);

      const now = Date.now();
      const entriesToRemove: string[] = [];

      for await (const [name, handle] of simulationDir.entries()) {
        if (handle.kind !== "directory") continue;

        try {
          const appDir = handle;
          const heartbeatHandle = await appDir.getFileHandle(HEARTBEAT_FILE);
          const file = await heartbeatHandle.getFile();
          const text = await file.text();
          const { timestamp } = JSON.parse(text);

          if (now - timestamp > thresholdMs) {
            entriesToRemove.push(name);
          }
        } catch {
          // No heartbeat file or invalid - consider it stale
          entriesToRemove.push(name);
        }
      }

      for (const name of entriesToRemove) {
        try {
          await simulationDir.removeEntry(name, { recursive: true });
        } catch {
          // Ignore removal errors
        }
      }
    } catch {
      // Root dir may not exist yet
    }
  }

  private async getRootDir(): Promise<FileSystemDirectoryHandle> {
    const root = await navigator.storage.getDirectory();
    return await root.getDirectoryHandle(ROOT_DIR, { create: true });
  }

  private async getAppDir(): Promise<FileSystemDirectoryHandle> {
    const root = await this.getRootDir();
    return await root.getDirectoryHandle(this.appId, { create: true });
  }
}
