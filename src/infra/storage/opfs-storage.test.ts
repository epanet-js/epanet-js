/* eslint-disable @typescript-eslint/no-unsafe-call */
import { OPFSStorage, cleanupStaleOPFS } from "./opfs-storage";

describe("OPFSStorage", () => {
  let mockAppDir: {
    getFileHandle: ReturnType<typeof vi.fn>;
    removeEntry: ReturnType<typeof vi.fn>;
  };
  let mockSimulationDir: {
    getDirectoryHandle: ReturnType<typeof vi.fn>;
    removeEntry: ReturnType<typeof vi.fn>;
    entries: ReturnType<typeof vi.fn>;
  };
  let mockRootDir: {
    getDirectoryHandle: ReturnType<typeof vi.fn>;
  };

  // Mock localStorage
  let mockLocalStorageData: Map<string, string>;
  let mockLocalStorage: {
    getItem: ReturnType<typeof vi.fn>;
    setItem: ReturnType<typeof vi.fn>;
    removeItem: ReturnType<typeof vi.fn>;
    key: ReturnType<typeof vi.fn>;
    length: number;
  };

  beforeEach(() => {
    mockLocalStorageData = new Map();

    mockLocalStorage = {
      getItem: vi.fn((key: string) => mockLocalStorageData.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockLocalStorageData.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        mockLocalStorageData.delete(key);
      }),
      key: vi.fn((index: number) => {
        const keys = Array.from(mockLocalStorageData.keys());
        return keys[index] ?? null;
      }),
      get length() {
        return mockLocalStorageData.size;
      },
    };

    vi.stubGlobal("localStorage", mockLocalStorage);

    mockAppDir = {
      getFileHandle: vi.fn(),
      removeEntry: vi.fn(),
    };
    mockSimulationDir = {
      getDirectoryHandle: vi.fn().mockResolvedValue(mockAppDir),
      removeEntry: vi.fn(),
      entries: vi.fn(),
    };
    mockRootDir = {
      getDirectoryHandle: vi.fn().mockResolvedValue(mockSimulationDir),
    };

    vi.stubGlobal("navigator", {
      storage: {
        getDirectory: vi.fn().mockResolvedValue(mockRootDir),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const createMockWritable = () => ({
    write: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  });

  const createMockFileHandle = (
    data: ArrayBuffer,
    writable = createMockWritable(),
  ) => ({
    getFile: vi.fn().mockResolvedValue({
      size: data.byteLength,
      slice: vi.fn((start: number, end: number) => ({
        arrayBuffer: vi.fn().mockResolvedValue(data.slice(start, end)),
      })),
    }),
    createWritable: vi.fn().mockResolvedValue(writable),
  });

  describe("save", () => {
    it("creates file and writes data", async () => {
      const mockWritable = createMockWritable();
      mockAppDir.getFileHandle.mockResolvedValue(
        createMockFileHandle(new ArrayBuffer(0), mockWritable),
      );

      const storage = new OPFSStorage("test-app-id");
      const data = new Uint8Array([1, 2, 3]).buffer;
      await storage.save("results.out", data);

      expect(mockAppDir.getFileHandle).toHaveBeenCalledWith("results.out", {
        create: true,
      });
      expect(mockWritable.write).toHaveBeenCalledWith(data);
      expect(mockWritable.close).toHaveBeenCalled();
    });

    it("updates last access after saving", async () => {
      mockAppDir.getFileHandle.mockResolvedValue(
        createMockFileHandle(new ArrayBuffer(0)),
      );

      const storage = new OPFSStorage("test-app-id");
      await storage.save("results.out", new Uint8Array([1]).buffer);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        "last-simulation-access:test-app-id",
        expect.stringContaining("timestamp"),
      );
    });
  });

  describe("readSlice", () => {
    it("reads slice of file", async () => {
      const fileData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer;
      mockAppDir.getFileHandle.mockResolvedValue(
        createMockFileHandle(fileData),
      );

      const storage = new OPFSStorage("test-app-id");
      const result = await storage.readSlice("results.out", 2, 3);

      expect(new Uint8Array(result!)).toEqual(new Uint8Array([3, 4, 5]));
    });

    it("returns null when file does not exist", async () => {
      mockAppDir.getFileHandle.mockRejectedValue(new Error("File not found"));

      const storage = new OPFSStorage("test-app-id");
      const result = await storage.readSlice("non-existent", 0, 10);

      expect(result).toBeNull();
    });

    it("updates last access after reading slice", async () => {
      mockAppDir.getFileHandle.mockResolvedValue(
        createMockFileHandle(new Uint8Array([1, 2, 3]).buffer),
      );

      const storage = new OPFSStorage("test-app-id");
      await storage.readSlice("results.out", 0, 2);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        "last-simulation-access:test-app-id",
        expect.stringContaining("timestamp"),
      );
    });
  });

  describe("clear", () => {
    it("removes app directory recursively", async () => {
      mockSimulationDir.removeEntry.mockResolvedValue(undefined);

      const storage = new OPFSStorage("test-app-id");
      await storage.clear();

      expect(mockSimulationDir.removeEntry).toHaveBeenCalledWith(
        "test-app-id",
        { recursive: true },
      );
    });

    it("does not throw when directory does not exist", async () => {
      mockSimulationDir.removeEntry.mockRejectedValue(new Error("Not found"));

      const storage = new OPFSStorage("test-app-id");
      await expect(storage.clear()).resolves.not.toThrow();
    });

    it("deletes last access from localStorage", async () => {
      mockSimulationDir.removeEntry.mockResolvedValue(undefined);

      const storage = new OPFSStorage("test-app-id");
      await storage.clear();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        "last-simulation-access:test-app-id",
      );
    });
  });

  describe("cleanupStale", () => {
    const TWO_WEEKS_MS = 1000 * 60 * 60 * 24 * 14;

    it("removes directories with old last access timestamps", async () => {
      const oldTimestamp = Date.now() - 1000 * 60 * 60 * 24 * 15; // 15 days ago
      mockLocalStorageData.set(
        "last-simulation-access:stale-app",
        JSON.stringify({ timestamp: oldTimestamp }),
      );

      await cleanupStaleOPFS(TWO_WEEKS_MS);

      expect(mockSimulationDir.removeEntry).toHaveBeenCalledWith("stale-app", {
        recursive: true,
      });
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        "last-simulation-access:stale-app",
      );
    });

    it("keeps directories with recent last access timestamps", async () => {
      const recentTimestamp = Date.now() - 1000 * 60 * 60; // 1 hour ago
      mockLocalStorageData.set(
        "last-simulation-access:recent-app",
        JSON.stringify({ timestamp: recentTimestamp }),
      );

      await cleanupStaleOPFS(TWO_WEEKS_MS);

      expect(mockSimulationDir.removeEntry).not.toHaveBeenCalled();
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
    });

    it("does not remove anything when no last access timestamps exist", async () => {
      await cleanupStaleOPFS(TWO_WEEKS_MS);

      expect(mockSimulationDir.removeEntry).not.toHaveBeenCalled();
    });
  });
});
