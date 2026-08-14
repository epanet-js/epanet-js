/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  OPFSStorage,
  cleanupStaleOPFS,
  createTempFile,
  getAvailableStorageBytes,
  isOPFSAvailable,
} from "./opfs-storage";

describe("OPFSStorage", () => {
  let mockAppDir: {
    getFileHandle: ReturnType<typeof vi.fn>;
    getDirectoryHandle: ReturnType<typeof vi.fn>;
    removeEntry: ReturnType<typeof vi.fn>;
  };
  let mockSimulationDir: {
    getDirectoryHandle: ReturnType<typeof vi.fn>;
    removeEntry: ReturnType<typeof vi.fn>;
    entries: ReturnType<typeof vi.fn>;
  };
  let mockTempDir: {
    getDirectoryHandle: ReturnType<typeof vi.fn>;
    keys: ReturnType<typeof vi.fn>;
    removeEntry: ReturnType<typeof vi.fn>;
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
      getDirectoryHandle: vi.fn(),
      removeEntry: vi.fn(),
    };
    mockSimulationDir = {
      getDirectoryHandle: vi.fn().mockResolvedValue(mockAppDir),
      removeEntry: vi.fn(),
      entries: vi.fn(),
    };
    mockTempDir = {
      getDirectoryHandle: vi.fn(),
      keys: vi.fn(() => toAsyncIterator([])),
      removeEntry: vi.fn().mockResolvedValue(undefined),
    };
    mockRootDir = {
      getDirectoryHandle: vi.fn((name: string) =>
        Promise.resolve(
          name === "epanet-temp" ? mockTempDir : mockSimulationDir,
        ),
      ),
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

  async function* toAsyncIterator(items: string[]) {
    for (const item of items) yield await Promise.resolve(item);
  }

  const createMockSyncAccessHandle = () => ({
    write: vi.fn(),
    close: vi.fn(),
  });

  const createMockFileHandle = (
    data: ArrayBuffer,
    syncAccessHandle = createMockSyncAccessHandle(),
  ) => ({
    getFile: vi.fn().mockResolvedValue({
      size: data.byteLength,
      slice: vi.fn((start: number, end: number) => ({
        arrayBuffer: vi.fn().mockResolvedValue(data.slice(start, end)),
      })),
    }),
    createSyncAccessHandle: vi.fn().mockResolvedValue(syncAccessHandle),
  });

  describe("save", () => {
    it("creates file and writes data", async () => {
      const mockAccessHandle = createMockSyncAccessHandle();
      mockAppDir.getFileHandle.mockResolvedValue(
        createMockFileHandle(new ArrayBuffer(0), mockAccessHandle),
      );

      const storage = new OPFSStorage("test-app-id");
      const data = new Uint8Array([1, 2, 3]).buffer;
      await storage.save("results.out", data);

      expect(mockAppDir.getFileHandle).toHaveBeenCalledWith("results.out", {
        create: true,
      });
      expect(mockAccessHandle.write).toHaveBeenCalledWith(data);
      expect(mockAccessHandle.close).toHaveBeenCalled();
    });

    it("does not update last access after saving (save runs in Web Worker where localStorage is unavailable)", async () => {
      mockAppDir.getFileHandle.mockResolvedValue(
        createMockFileHandle(new ArrayBuffer(0)),
      );

      const storage = new OPFSStorage("test-app-id");
      await storage.save("results.out", new Uint8Array([1]).buffer);

      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
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

      expect(new Uint8Array(result)).toEqual(new Uint8Array([3, 4, 5]));
    });

    it("throws when file does not exist", async () => {
      mockAppDir.getFileHandle.mockRejectedValue(new Error("File not found"));

      const storage = new OPFSStorage("test-app-id");

      await expect(storage.readSlice("non-existent", 0, 10)).rejects.toThrow(
        "File not found",
      );
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

  describe("clearRun", () => {
    it("removes only the run directory from the scenario dir", async () => {
      const mockScenarioDir = {
        getDirectoryHandle: vi.fn(),
        removeEntry: vi.fn().mockResolvedValue(undefined),
      };
      mockAppDir.getDirectoryHandle = vi
        .fn()
        .mockResolvedValue(mockScenarioDir);

      const storage = new OPFSStorage("test-app-id", "scenario-1", "run-abc");
      await storage.clearRun();

      expect(mockSimulationDir.getDirectoryHandle).toHaveBeenCalledWith(
        "test-app-id",
      );
      expect(mockAppDir.getDirectoryHandle).toHaveBeenCalledWith("scenario-1");
      expect(mockScenarioDir.removeEntry).toHaveBeenCalledWith("run-abc", {
        recursive: true,
      });
    });

    it("removes run directory from app dir when no scenarioKey", async () => {
      mockAppDir.removeEntry = vi.fn().mockResolvedValue(undefined);

      const storage = new OPFSStorage("test-app-id", undefined, "run-abc");
      await storage.clearRun();

      expect(mockAppDir.removeEntry).toHaveBeenCalledWith("run-abc", {
        recursive: true,
      });
    });

    it("propagates failures so the caller can classify them", async () => {
      const mockScenarioDir = {
        getDirectoryHandle: vi.fn(),
        removeEntry: vi.fn().mockRejectedValue(new Error("removeEntry failed")),
      };
      mockAppDir.getDirectoryHandle = vi
        .fn()
        .mockResolvedValue(mockScenarioDir);

      const storage = new OPFSStorage("test-app-id", "scenario-1", "run-abc");
      await expect(storage.clearRun()).rejects.toThrow("removeEntry failed");
    });

    it("is a no-op when no runId is set", async () => {
      const storage = new OPFSStorage("test-app-id", "scenario-1");
      await storage.clearRun();

      expect(mockSimulationDir.getDirectoryHandle).not.toHaveBeenCalled();
    });

    it("does not remove the heartbeat key", async () => {
      const mockScenarioDir = {
        getDirectoryHandle: vi.fn(),
        removeEntry: vi.fn().mockResolvedValue(undefined),
      };
      mockAppDir.getDirectoryHandle = vi
        .fn()
        .mockResolvedValue(mockScenarioDir);

      const storage = new OPFSStorage("test-app-id", "scenario-1", "run-abc");
      await storage.clearRun();

      expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
    });
  });

  describe("createTempFile", () => {
    it("creates the file inside the app's temp directory", async () => {
      const mockFileHandle = createMockFileHandle(new ArrayBuffer(0));
      const mockTempAppDir = {
        getFileHandle: vi.fn().mockResolvedValue(mockFileHandle),
      };
      mockTempDir.getDirectoryHandle.mockResolvedValue(mockTempAppDir);

      const handle = await createTempFile("test-app-id", "export.zip");

      expect(mockRootDir.getDirectoryHandle).toHaveBeenCalledWith(
        "epanet-temp",
        { create: true },
      );
      expect(mockTempDir.getDirectoryHandle).toHaveBeenCalledWith(
        "test-app-id",
        { create: true },
      );
      expect(mockTempAppDir.getFileHandle).toHaveBeenCalledWith("export.zip", {
        create: true,
      });
      expect(handle).toBe(mockFileHandle);
    });

    it("does not touch the simulation directory", async () => {
      mockTempDir.getDirectoryHandle.mockResolvedValue({
        getFileHandle: vi.fn().mockResolvedValue({}),
      });

      await createTempFile("test-app-id", "export.zip");

      expect(mockRootDir.getDirectoryHandle).not.toHaveBeenCalledWith(
        "epanet-simulation",
        expect.anything(),
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

      await cleanupStaleOPFS(TWO_WEEKS_MS, "current-app");

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

      await cleanupStaleOPFS(TWO_WEEKS_MS, "current-app");

      expect(mockSimulationDir.removeEntry).not.toHaveBeenCalled();
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
    });

    it("does not remove anything when no last access timestamps exist", async () => {
      await cleanupStaleOPFS(TWO_WEEKS_MS, "current-app");

      expect(mockSimulationDir.removeEntry).not.toHaveBeenCalled();
    });

    it("removes temp directories from other app instances", async () => {
      mockTempDir.keys.mockReturnValue(
        toAsyncIterator(["current-app", "other-app", "another-app"]),
      );

      await cleanupStaleOPFS(TWO_WEEKS_MS, "current-app");

      expect(mockTempDir.removeEntry).toHaveBeenCalledWith("other-app", {
        recursive: true,
      });
      expect(mockTempDir.removeEntry).toHaveBeenCalledWith("another-app", {
        recursive: true,
      });
      expect(mockTempDir.removeEntry).not.toHaveBeenCalledWith(
        "current-app",
        expect.anything(),
      );
    });

    it("does not throw when the temp directory does not exist", async () => {
      mockRootDir.getDirectoryHandle.mockImplementation((name: string) =>
        name === "epanet-temp"
          ? Promise.reject(new Error("NotFoundError"))
          : Promise.resolve(mockSimulationDir),
      );

      await expect(
        cleanupStaleOPFS(TWO_WEEKS_MS, "current-app"),
      ).resolves.not.toThrow();
    });

    it("keeps cleaning temp directories when one removal fails", async () => {
      mockTempDir.keys.mockReturnValue(
        toAsyncIterator(["failing-app", "other-app"]),
      );
      mockTempDir.removeEntry
        .mockRejectedValueOnce(new Error("NotFoundError"))
        .mockResolvedValueOnce(undefined);

      await cleanupStaleOPFS(TWO_WEEKS_MS, "current-app");

      expect(mockTempDir.removeEntry).toHaveBeenCalledWith("other-app", {
        recursive: true,
      });
    });
  });
});

describe("isOPFSAvailable", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const stubGetDirectory = (getDirectory: unknown) => {
    vi.stubGlobal("navigator", { storage: { getDirectory } });
  };

  it("is available when the root dir opens", async () => {
    stubGetDirectory(vi.fn().mockResolvedValue({}));

    expect(await isOPFSAvailable()).toBe(true);
  });

  it("is unavailable when the root dir cannot be opened", async () => {
    stubGetDirectory(vi.fn().mockRejectedValue(new Error("nope")));

    expect(await isOPFSAvailable()).toBe(false);
  });

  it("is available without writable file streams", async () => {
    stubGetDirectory(vi.fn().mockResolvedValue({}));
    vi.stubGlobal("FileSystemFileHandle", class FileSystemFileHandle {});

    expect(await isOPFSAvailable()).toBe(true);
  });
});

describe("getAvailableStorageBytes", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const stubEstimate = (estimate: unknown) => {
    vi.stubGlobal("navigator", { storage: { estimate } });
  };

  it("returns quota minus usage", async () => {
    stubEstimate(vi.fn().mockResolvedValue({ quota: 1000, usage: 200 }));

    expect(await getAvailableStorageBytes()).toBe(800);
  });

  it("treats missing usage as zero", async () => {
    stubEstimate(vi.fn().mockResolvedValue({ quota: 1000 }));

    expect(await getAvailableStorageBytes()).toBe(1000);
  });

  it("returns zero when the quota is undefined", async () => {
    stubEstimate(vi.fn().mockResolvedValue({ usage: 200 }));

    expect(await getAvailableStorageBytes()).toEqual(0);
  });

  it("returns zero when estimate is unavailable", async () => {
    stubEstimate(undefined);

    expect(await getAvailableStorageBytes()).toEqual(0);
  });

  it("returns zero when estimate throws", async () => {
    stubEstimate(vi.fn().mockRejectedValue(new Error("nope")));

    expect(await getAvailableStorageBytes()).toEqual(0);
  });
});
