/* eslint-disable @typescript-eslint/no-unsafe-call */
import { OPFSStorage } from "./opfs-storage";

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

  beforeEach(() => {
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

    it("updates heartbeat after saving", async () => {
      mockAppDir.getFileHandle.mockResolvedValue(
        createMockFileHandle(new ArrayBuffer(0)),
      );

      const storage = new OPFSStorage("test-app-id");
      await storage.save("results.out", new Uint8Array([1]).buffer);

      expect(mockAppDir.getFileHandle).toHaveBeenCalledWith("heartbeat.json", {
        create: true,
      });
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

    it("updates heartbeat after reading slice", async () => {
      mockAppDir.getFileHandle.mockResolvedValue(
        createMockFileHandle(new Uint8Array([1, 2, 3]).buffer),
      );

      const storage = new OPFSStorage("test-app-id");
      await storage.readSlice("results.out", 0, 2);

      expect(mockAppDir.getFileHandle).toHaveBeenCalledWith("heartbeat.json", {
        create: true,
      });
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
  });

  describe("updateHeartbeat", () => {
    it("writes timestamp to heartbeat file", async () => {
      const mockWritable = createMockWritable();
      mockAppDir.getFileHandle.mockResolvedValue({
        createWritable: vi.fn().mockResolvedValue(mockWritable),
      });

      const storage = new OPFSStorage("test-app-id");
      const beforeTime = Date.now();
      await storage.updateHeartbeat();
      const afterTime = Date.now();

      expect(mockAppDir.getFileHandle).toHaveBeenCalledWith("heartbeat.json", {
        create: true,
      });

      const writtenData = mockWritable.write.mock.calls[0][0] as string;
      const parsed = JSON.parse(writtenData);
      expect(parsed.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(parsed.timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe("cleanupStale", () => {
    const TWO_WEEKS_MS = 1000 * 60 * 60 * 24 * 14;

    const createHeartbeatFile = (timestamp: number) => ({
      text: vi.fn().mockResolvedValue(JSON.stringify({ timestamp })),
    });

    it("removes directories with old heartbeats", async () => {
      const oldTimestamp = Date.now() - 1000 * 60 * 60 * 24 * 15; // 15 days ago
      const staleAppDir = {
        kind: "directory",
        getFileHandle: vi.fn().mockResolvedValue({
          getFile: vi.fn().mockResolvedValue(createHeartbeatFile(oldTimestamp)),
        }),
      };
      mockSimulationDir.entries.mockReturnValue({
        async *[Symbol.asyncIterator]() {
          await Promise.resolve();
          yield ["stale-app", staleAppDir];
        },
      });

      await OPFSStorage.cleanupStale(TWO_WEEKS_MS);

      expect(mockSimulationDir.removeEntry).toHaveBeenCalledWith("stale-app", {
        recursive: true,
      });
    });

    it("keeps directories with recent heartbeats", async () => {
      const recentTimestamp = Date.now() - 1000 * 60 * 60; // 1 hour ago
      const recentAppDir = {
        kind: "directory",
        getFileHandle: vi.fn().mockResolvedValue({
          getFile: vi
            .fn()
            .mockResolvedValue(createHeartbeatFile(recentTimestamp)),
        }),
      };
      mockSimulationDir.entries.mockReturnValue({
        async *[Symbol.asyncIterator]() {
          await Promise.resolve();
          yield ["recent-app", recentAppDir];
        },
      });

      await OPFSStorage.cleanupStale(TWO_WEEKS_MS);

      expect(mockSimulationDir.removeEntry).not.toHaveBeenCalled();
    });

    it("removes directories without heartbeat files", async () => {
      const noHeartbeatDir = {
        kind: "directory",
        getFileHandle: vi.fn().mockRejectedValue(new Error("Not found")),
      };
      mockSimulationDir.entries.mockReturnValue({
        async *[Symbol.asyncIterator]() {
          await Promise.resolve();
          yield ["no-heartbeat-app", noHeartbeatDir];
        },
      });

      await OPFSStorage.cleanupStale(TWO_WEEKS_MS);

      expect(mockSimulationDir.removeEntry).toHaveBeenCalledWith(
        "no-heartbeat-app",
        { recursive: true },
      );
    });
  });
});
