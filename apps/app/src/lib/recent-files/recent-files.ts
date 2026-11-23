import { nanoid } from "nanoid";
import { IKeyValueStore, IndexedDB } from "src/infra/storage";
import { catchErrors } from "src/infra/errors";
import { captureWarning } from "src/infra/error-tracking";

const STORE_NAME = "recent-files";
const MAX_ENTRIES = 10;
const COMPARE_TIMEOUT_MS = 3000;

export type RecentFileEntry = {
  id: string;
  name: string;
  handle: FileSystemFileHandle;
  openedAt: number;
  thumbnail?: string;
};

export class HandleUnresponsiveError extends Error {
  name = "HandleUnresponsiveError";
}

export const withHandleTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new HandleUnresponsiveError("File handle did not respond")),
      timeoutMs,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

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
    await catchErrors(() => this.persist(name, handle, thumbnail), {
      as: "RecentFilesStore: failed to write to IndexedDB",
    });
  }

  private async persist(
    name: string,
    handle: FileSystemFileHandle,
    thumbnail?: string,
  ): Promise<void> {
    const all = await this.db.getAll<RecentFileEntry>(STORE_NAME);
    const existing = await findSameEntry(handle, all);

    if (existing) {
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

async function findSameEntry(
  handle: FileSystemFileHandle,
  entries: RecentFileEntry[],
): Promise<RecentFileEntry | undefined> {
  const failures: unknown[] = [];
  const matches = await Promise.all(
    entries.map((entry) =>
      withHandleTimeout(
        handle.isSameEntry(entry.handle),
        COMPARE_TIMEOUT_MS,
      ).catch((error: unknown) => {
        failures.push(error);
        return false;
      }),
    ),
  );
  if (failures.length > 0) {
    const errors: Record<string, number> = {};
    for (const failure of failures) {
      const name = errorName(failure);
      errors[name] = (errors[name] ?? 0) + 1;
    }
    const representative =
      failures.find((f) => !(f instanceof HandleUnresponsiveError)) ??
      failures[0];
    captureWarning(
      "RecentFilesStore: stored handle comparison failed",
      representative,
      {
        recentFiles: {
          failed: failures.length,
          total: entries.length,
          errors,
        },
      },
    );
  }
  return entries.find((_, i) => matches[i]);
}

function errorName(error: unknown): string {
  const name = (error as { name?: unknown } | null)?.name;
  return typeof name === "string" ? name : "unknown";
}
