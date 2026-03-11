import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { InMemoryKeyValueStore } from "src/infra/storage";
import { RecentFilesStore } from "./recent-files";

const STORE_NAME = "recent-files";

type HandleWithPath = FileSystemFileHandle & { _path: string };

const buildHandle = (path: string, fileName: string): FileSystemFileHandle => {
  const handle = {
    _path: path,
    name: fileName,
    kind: "file" as const,
    isSameEntry: vi.fn((other: HandleWithPath) =>
      Promise.resolve(other._path === path),
    ),
  };
  return handle as unknown as FileSystemFileHandle;
};

const createStore = () => {
  const db = new InMemoryKeyValueStore();
  db.defineStore(STORE_NAME, "id");
  return { db, store: new RecentFilesStore(db) };
};

// Stub FileSystemFileHandle globally so isSupported() returns true
vi.stubGlobal("FileSystemFileHandle", class FileSystemFileHandle {});

describe("RecentFilesStore", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("getAll", () => {
    it("returns empty array when no entries exist", async () => {
      const { store } = createStore();
      expect(await store.getAll()).toEqual([]);
    });

    it("returns entries sorted by openedAt descending", async () => {
      const { store } = createStore();
      const h1 = buildHandle("/a.inp", "a.inp");
      const h2 = buildHandle("/b.inp", "b.inp");
      const h3 = buildHandle("/c.inp", "c.inp");

      vi.setSystemTime(new Date(1000));
      await store.add("a.inp", h1);
      vi.setSystemTime(new Date(3000));
      await store.add("b.inp", h2);
      vi.setSystemTime(new Date(2000));
      await store.add("c.inp", h3);

      const entries = await store.getAll();
      expect(entries.map((e) => e.name)).toEqual(["b.inp", "c.inp", "a.inp"]);

      vi.useRealTimers();
    });
  });

  describe("add", () => {
    it("adds a new entry", async () => {
      const { store } = createStore();
      const handle = buildHandle("/test.inp", "test.inp");

      await store.add("test.inp", handle);

      const entries = await store.getAll();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual(
        expect.objectContaining({
          name: "test.inp",
          handle,
        }),
      );
    });

    it("deduplicates by handle using isSameEntry", async () => {
      const { store } = createStore();
      const handle = buildHandle("/test.inp", "test.inp");

      vi.setSystemTime(new Date(1000));
      await store.add("test.inp", handle);
      vi.setSystemTime(new Date(2000));
      await store.add("renamed.inp", handle);

      const entries = await store.getAll();
      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe("renamed.inp");
      expect(entries[0].openedAt).toBe(2000);

      vi.useRealTimers();
    });

    it("does not deduplicate entries with different handles but same name", async () => {
      const { store } = createStore();
      const h1 = buildHandle("/dir1/test.inp", "test.inp");
      const h2 = buildHandle("/dir2/test.inp", "test.inp");

      await store.add("test.inp", h1);
      await store.add("test.inp", h2);

      const entries = await store.getAll();
      expect(entries).toHaveLength(2);
    });

    it("caps at 5 entries, evicting the oldest", async () => {
      const { db, store } = createStore();

      for (let i = 0; i < 5; i++) {
        vi.setSystemTime(new Date(i * 1000));
        await store.add(
          `file-${i}.inp`,
          buildHandle(`/file-${i}.inp`, `file-${i}.inp`),
        );
      }

      vi.setSystemTime(new Date(5000));
      await store.add(
        "file-new.inp",
        buildHandle("/file-new.inp", "file-new.inp"),
      );

      const entries = await store.getAll();
      expect(entries).toHaveLength(5);
      expect(entries.map((e) => e.name)).not.toContain("file-0.inp");
      expect(entries[0].name).toBe("file-new.inp");

      const raw = await db.getAll(STORE_NAME);
      expect(raw).toHaveLength(5);

      vi.useRealTimers();
    });
  });

  describe("remove", () => {
    it("removes an entry by id", async () => {
      const { store } = createStore();
      await store.add("test.inp", buildHandle("/test.inp", "test.inp"));

      const entries = await store.getAll();
      await store.remove(entries[0].id);

      expect(await store.getAll()).toHaveLength(0);
    });

    it("no-ops when id does not exist", async () => {
      const { store } = createStore();
      await expect(store.remove("non-existent")).resolves.toBeUndefined();
    });
  });

  describe("non-Chromium (no FileSystemFileHandle)", () => {
    beforeEach(() => {
      // @ts-expect-error - simulating non-Chromium
      delete globalThis.FileSystemFileHandle;
    });

    afterEach(() => {
      vi.stubGlobal("FileSystemFileHandle", class FileSystemFileHandle {});
    });

    it("getAll returns empty array", async () => {
      const { store } = createStore();
      expect(await store.getAll()).toEqual([]);
    });

    it("add is a no-op", async () => {
      const { db, store } = createStore();
      await store.add("test.inp", {} as unknown as FileSystemFileHandle);
      // Check nothing was written to the underlying store
      const raw = await db.getAll(STORE_NAME);
      expect(raw).toEqual([]);
    });

    it("remove is a no-op", async () => {
      const { store } = createStore();
      await expect(store.remove("any")).resolves.toBeUndefined();
    });
  });
});
