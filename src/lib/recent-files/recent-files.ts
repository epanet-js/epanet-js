import { nanoid } from "nanoid";
import { IKeyValueStore, IndexedDB } from "src/infra/storage";

const STORE_NAME = "recent-files";
const MAX_ENTRIES = 10;

export type RecentFileEntry = {
  id: string;
  name: string;
  handle: FileSystemFileHandle;
  openedAt: number;
  thumbnail?: string;
};

function isSupported(): boolean {
  return typeof FileSystemFileHandle !== "undefined";
}

export const defaultRecentFilesDb = () =>
  new IndexedDB({
    name: "epanet-recent-files",
    version: 2,
    migrations: {
      1: (db) => {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      },
      2: (_db) => {
        // thumbnail field added to RecentFileEntry (optional, no schema change needed)
      },
    },
  });

export class RecentFilesStore {
  private db: IKeyValueStore;

  constructor(db: IKeyValueStore) {
    this.db = db;
  }

  async getAll(): Promise<RecentFileEntry[]> {
    if (!isSupported()) return [];
    const entries = await this.db.getAll<RecentFileEntry>(STORE_NAME);
    return entries.sort((a, b) => b.openedAt - a.openedAt);
  }

  async add(
    name: string,
    handle: FileSystemFileHandle,
    thumbnail?: string,
  ): Promise<void> {
    if (!isSupported()) return;
    const all = await this.db.getAll<RecentFileEntry>(STORE_NAME);

    let existingId: string | null = null;
    for (const entry of all) {
      if (await handle.isSameEntry(entry.handle)) {
        existingId = entry.id;
        break;
      }
    }

    if (existingId) {
      const existing = all.find((e) => e.id === existingId)!;
      await this.db.put(STORE_NAME, {
        ...existing,
        name,
        handle,
        openedAt: Date.now(),
        thumbnail,
      });
    } else {
      const ops: Array<
        { type: "put"; value: unknown } | { type: "delete"; key: string }
      > = [];

      const sorted = all.sort((a, b) => b.openedAt - a.openedAt);
      if (sorted.length >= MAX_ENTRIES) {
        for (const entry of sorted.slice(MAX_ENTRIES - 1)) {
          ops.push({ type: "delete", key: entry.id });
        }
      }

      ops.push({
        type: "put",
        value: {
          id: nanoid(),
          name,
          handle,
          openedAt: Date.now(),
          thumbnail,
        },
      });

      await this.db.batch(STORE_NAME, ops);
    }
  }

  async remove(id: string): Promise<void> {
    if (!isSupported()) return;
    await this.db.delete(STORE_NAME, id);
  }
}
