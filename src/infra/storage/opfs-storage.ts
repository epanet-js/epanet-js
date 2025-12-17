import { IPrivateAppStorage } from "./private-app-storage";

const ROOT_DIR = "epanet-simulation";
const HEARTBEAT_KEY_PREFIX = "last-simulation-access:";

export class OPFSStorage implements IPrivateAppStorage {
  constructor(private readonly appId: string) {}

  async save(filename: string, data: ArrayBuffer): Promise<void> {
    const dir = await this.getAppDir();
    const fileHandle = await dir.getFileHandle(filename, { create: true });
    // @ts-expect-error createSyncAccessHandle is only available in Web Workers (lib.webworker.d.ts)
    const accessHandle = await fileHandle.createSyncAccessHandle();
    accessHandle.write(data);
    accessHandle.close();
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
      this.touchLastAccess();
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
    await clearApp(this.appId);
  }

  private touchLastAccess(): void {
    localStorage.setItem(
      `${HEARTBEAT_KEY_PREFIX}${this.appId}`,
      JSON.stringify({ timestamp: Date.now() }),
    );
  }

  private async getAppDir(): Promise<FileSystemDirectoryHandle> {
    const root = await getRootDir();
    return await root.getDirectoryHandle(this.appId, { create: true });
  }
}

export async function cleanupStaleOPFS(thresholdMs: number): Promise<void> {
  const staleAppIds = findStaleAppIds(thresholdMs);

  for (const appId of staleAppIds) {
    await clearApp(appId);
  }
}

async function getRootDir(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return await root.getDirectoryHandle(ROOT_DIR, { create: true });
}

async function clearApp(appId: string): Promise<void> {
  try {
    const root = await getRootDir();
    await root.removeEntry(appId, { recursive: true });
  } catch {
    // Directory may not exist
  }

  localStorage.removeItem(`${HEARTBEAT_KEY_PREFIX}${appId}`);
}

function findStaleAppIds(thresholdMs: number): string[] {
  const now = Date.now();
  const staleAppIds: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(HEARTBEAT_KEY_PREFIX)) continue;

    try {
      const data = localStorage.getItem(key);
      const { timestamp } = JSON.parse(data || "{}") as { timestamp: number };
      if (now - timestamp > thresholdMs) {
        staleAppIds.push(key.slice(HEARTBEAT_KEY_PREFIX.length));
      }
    } catch {
      staleAppIds.push(key.slice(HEARTBEAT_KEY_PREFIX.length));
    }
  }

  return staleAppIds;
}
