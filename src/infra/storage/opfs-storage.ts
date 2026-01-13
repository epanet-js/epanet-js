import { IPrivateAppStorage } from "./private-app-storage";

const ROOT_DIR = "epanet-simulation";
const HEARTBEAT_KEY_PREFIX = "last-simulation-access:";

export class OPFSStorage implements IPrivateAppStorage {
  constructor(
    private readonly appId: string,
    private readonly scenarioKey?: string,
  ) {}

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

  async readBlockSeries(
    filename: string,
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
        readPromises.push(this.readSlice(filename, offset, readSize));
      }

      const results = await Promise.all(readPromises);
      for (let i = 0; i < results.length; i++) {
        const data = results[i];
        if (data) {
          resultView.set(new Uint8Array(data), (startIdx + i) * readSize);
        }
      }
    }

    this.touchLastAccess();
    return result;
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
    const appDir = await root.getDirectoryHandle(this.appId, { create: true });
    if (this.scenarioKey) {
      return await appDir.getDirectoryHandle(this.scenarioKey, { create: true });
    }
    return appDir;
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
