import { IKeyBufferStore } from "./types";

const ROOT_DIR = "epanet-simulation";
const HEARTBEAT_KEY_PREFIX = "last-simulation-access:";

export class OPFSStorage implements IKeyBufferStore {
  constructor(
    private readonly appId: string,
    private readonly scenarioKey?: string,
  ) {}

  async save(filename: string, data: ArrayBuffer): Promise<void> {
    const dir = await this.getAppDir();
    const fileHandle = await dir.getFileHandle(filename, { create: true });
    // @ts-expect-error createSyncAccessHandle is only available in Web Workers (lib.webworker.d.ts)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const accessHandle = await fileHandle.createSyncAccessHandle();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    accessHandle.write(data);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    accessHandle.close();
  }

  async readSlice(
    filename: string,
    offset: number,
    length: number,
  ): Promise<ArrayBuffer> {
    const dir = await this.getAppDir();
    const fileHandle = await dir.getFileHandle(filename);
    const file = await fileHandle.getFile();
    const slice = file.slice(offset, offset + length);
    const result = await slice.arrayBuffer();
    this.touchLastAccess();
    return result;
  }

  async readBlockSeries(
    filename: string,
    baseOffset: number,
    readSize: number,
    blockSize: number,
    blockCount: number,
  ): Promise<ArrayBuffer> {
    if (blockCount === 0) return new ArrayBuffer(0);

    // One large contiguous read is dramatically faster than many small slices,
    // but the strided range can be huge on big networks (blockSize = the full
    // per-timestep results record). We read it in chunks of at most
    // maxBlocksPerChunk blocks so the temporary buffer stays bounded. The
    // file handle is opened once and reused across chunks.
    const MAX_BYTES_PER_CHUNK = 64 * 1024 * 1024;
    const maxBlocksPerChunk = Math.max(
      1,
      Math.floor(MAX_BYTES_PER_CHUNK / blockSize),
    );

    const dir = await this.getAppDir();
    const fileHandle = await dir.getFileHandle(filename);
    const file = await fileHandle.getFile();

    type Chunk = { firstBlock: number; blocksInChunk: number };
    const chunks: Chunk[] = [];
    for (
      let firstBlock = 0;
      firstBlock < blockCount;
      firstBlock += maxBlocksPerChunk
    ) {
      chunks.push({
        firstBlock,
        blocksInChunk: Math.min(maxBlocksPerChunk, blockCount - firstBlock),
      });
    }

    const chunkBuffers = await Promise.all(
      chunks.map(({ firstBlock, blocksInChunk }) => {
        const chunkOffset = baseOffset + firstBlock * blockSize;
        const chunkLength = (blocksInChunk - 1) * blockSize + readSize;
        return file.slice(chunkOffset, chunkOffset + chunkLength).arrayBuffer();
      }),
    );

    const result = new ArrayBuffer(readSize * blockCount);
    const dst = new Uint8Array(result);
    for (let c = 0; c < chunks.length; c++) {
      const { firstBlock, blocksInChunk } = chunks[c];
      const chunk = new Uint8Array(chunkBuffers[c]);
      for (let i = 0; i < blocksInChunk; i++) {
        const srcOffset = i * blockSize;
        const dstOffset = (firstBlock + i) * readSize;
        dst.set(chunk.subarray(srcOffset, srcOffset + readSize), dstOffset);
      }
    }

    this.touchLastAccess();
    return result;
  }

  async getSize(filename: string): Promise<number> {
    const dir = await this.getAppDir();
    const fileHandle = await dir.getFileHandle(filename);
    const file = await fileHandle.getFile();
    return file.size;
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
      return await appDir.getDirectoryHandle(this.scenarioKey, {
        create: true,
      });
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
