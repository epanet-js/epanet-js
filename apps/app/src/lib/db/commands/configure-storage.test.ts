import { describe, it, expect, vi, beforeEach } from "vitest";

const configure = vi.fn();
const sahpoolFailure = vi.fn<() => { name: string; message: string } | null>(
  () => null,
);
const cleanupStaleDbPools = vi.fn<
  (
    appId: string,
    protectedIds: string[],
    isPoolInUse?: (id: string) => Promise<boolean>,
  ) => Promise<void>
>(() => Promise.resolve());
vi.mock("@epanet-js/ejsdb", async (importActual) => ({
  ...(await importActual<typeof import("@epanet-js/ejsdb")>()),
  getWorker: () => ({ configure, sahpoolFailure }),
  cleanupStaleDbPools: (
    appId: string,
    protectedIds: string[],
    isPoolInUse?: (id: string) => Promise<boolean>,
  ) => cleanupStaleDbPools(appId, protectedIds, isPoolInUse),
}));

const readRecoveryFingerprints = vi.fn<() => { poolId: string }[]>(() => []);
vi.mock("src/infra/session-recovery", () => ({
  readRecoveryFingerprints: () => readRecoveryFingerprints(),
}));

const isSessionAlive = vi.fn<(appId: string) => Promise<boolean>>(() =>
  Promise.resolve(false),
);
const holdSessionLock = vi.fn<(appId: string) => Promise<void>>(() =>
  Promise.resolve(),
);
vi.mock("src/infra/session-lock", () => ({
  isSessionAlive: (appId: string) => isSessionAlive(appId),
  holdSessionLock: (appId: string) => holdSessionLock(appId),
}));

const isOPFSAvailable = vi.fn<() => Promise<boolean>>();
const getAvailableStorageBytes = vi.fn<() => Promise<number | null>>();
vi.mock("src/infra/storage", async (importActual) => ({
  ...(await importActual<typeof import("src/infra/storage")>()),
  isOPFSAvailable: () => isOPFSAvailable(),
  getAvailableStorageBytes: () => getAvailableStorageBytes(),
}));

const getAppId = vi.fn(() => "tab-a");
const resetAppId = vi.fn(() => "tab-a-fresh");
vi.mock("src/infra/app-instance", () => ({
  getAppId: () => getAppId(),
  resetAppId: () => resetAppId(),
}));

const captureWarning = vi.fn<(...args: unknown[]) => void>();
const captureInfo = vi.fn<(message: string) => void>();
vi.mock("src/infra/error-tracking", async (importActual) => ({
  ...(await importActual<typeof import("src/infra/error-tracking")>()),
  captureWarning: (...args: unknown[]) => captureWarning(...args),
  captureInfo: (message: string) => captureInfo(message),
}));

import { configureDbStorage } from "./configure-storage";

const gibibyte = 1024 * 1024 * 1024;

const fallbackMessage = (reason: string) =>
  `OPFS db storage requested but fell back to in-memory db: ${reason}`;

beforeEach(() => {
  vi.clearAllMocks();
  readRecoveryFingerprints.mockReturnValue([]);
  getAvailableStorageBytes.mockResolvedValue(gibibyte);
});

describe("configureDbStorage", () => {
  it("regenerates the appId and retries once when the sahpool install clashes", async () => {
    isOPFSAvailable.mockResolvedValue(true);
    configure.mockResolvedValueOnce("memory").mockResolvedValueOnce("sahpool");

    const result = await configureDbStorage({ sessionHistory: false });

    expect(result).toBe("sahpool");
    expect(configure).toHaveBeenNthCalledWith(1, {
      mode: "sahpool",
      sahpoolId: "tab-a",
      sessionHistory: false,
    });
    expect(resetAppId).toHaveBeenCalledTimes(1);
    expect(configure).toHaveBeenNthCalledWith(2, {
      mode: "sahpool",
      sahpoolId: "tab-a-fresh",
      sessionHistory: false,
    });
    expect(cleanupStaleDbPools).toHaveBeenCalledWith(
      "tab-a-fresh",
      [],
      expect.any(Function),
    );
    expect(captureWarning).not.toHaveBeenCalled();
  });

  it("does not retry when the first sahpool install succeeds", async () => {
    isOPFSAvailable.mockResolvedValue(true);
    configure.mockResolvedValueOnce("sahpool");

    await configureDbStorage({ sessionHistory: false });

    expect(configure).toHaveBeenCalledTimes(1);
    expect(resetAppId).not.toHaveBeenCalled();
    expect(cleanupStaleDbPools).toHaveBeenCalledWith(
      "tab-a",
      [],
      expect.any(Function),
    );
  });

  it("warns and stays in memory when the retry also fails", async () => {
    isOPFSAvailable.mockResolvedValue(true);
    configure.mockResolvedValue("memory");

    const result = await configureDbStorage({ sessionHistory: false });

    expect(result).toBe("memory");
    expect(configure).toHaveBeenCalledTimes(2);
    expect(captureWarning).toHaveBeenCalledTimes(1);
    expect(captureWarning).toHaveBeenCalledWith(
      fallbackMessage("db-worker-fallback"),
    );
    expect(cleanupStaleDbPools).not.toHaveBeenCalled();
  });

  it("reports why the sahpool install failed when the worker knows", async () => {
    isOPFSAvailable.mockResolvedValue(true);
    configure.mockResolvedValue("memory");
    sahpoolFailure.mockReturnValue({
      name: "NotAllowedError",
      message: "no access handle",
    });

    await configureDbStorage({ sessionHistory: false });

    expect(captureWarning).toHaveBeenCalledWith(
      fallbackMessage("db-worker-fallback"),
      expect.objectContaining({
        message: "NotAllowedError: no access handle",
      }),
    );
  });

  describe("storage quota", () => {
    it("initializes the worker in memory and warns when available space is below the threshold", async () => {
      isOPFSAvailable.mockResolvedValue(true);
      getAvailableStorageBytes.mockResolvedValue(256 * 1024 * 1024);
      configure.mockResolvedValue("memory");

      const result = await configureDbStorage({ sessionHistory: false });

      expect(result).toBe("memory");
      expect(configure).toHaveBeenCalledTimes(1);
      expect(configure).toHaveBeenCalledWith({
        mode: "memory",
        sahpoolId: "tab-a",
        sessionHistory: false,
      });
      expect(captureWarning).toHaveBeenCalledTimes(1);
      expect(captureWarning).toHaveBeenCalledWith(
        fallbackMessage("opfs-quota-exceeded"),
      );
      expect(holdSessionLock).not.toHaveBeenCalled();
      expect(cleanupStaleDbPools).not.toHaveBeenCalled();
    });

    it("uses OPFS when available space meets the threshold", async () => {
      isOPFSAvailable.mockResolvedValue(true);
      getAvailableStorageBytes.mockResolvedValue(512 * 1024 * 1024);
      configure.mockResolvedValueOnce("sahpool");

      const result = await configureDbStorage({ sessionHistory: false });

      expect(result).toBe("sahpool");
      expect(captureWarning).not.toHaveBeenCalled();
    });

    it("treats an unmeasurable (zero) quota as below the threshold", async () => {
      isOPFSAvailable.mockResolvedValue(true);
      getAvailableStorageBytes.mockResolvedValue(0);
      configure.mockResolvedValue("memory");

      const result = await configureDbStorage({ sessionHistory: false });

      expect(result).toBe("memory");
      expect(configure).toHaveBeenCalledWith({
        mode: "memory",
        sahpoolId: "tab-a",
        sessionHistory: false,
      });
      expect(captureWarning).toHaveBeenCalledWith(
        fallbackMessage("opfs-quota-exceeded"),
      );
      expect(holdSessionLock).not.toHaveBeenCalled();
    });

    it("initializes the worker in memory without measuring the quota when OPFS is unavailable", async () => {
      isOPFSAvailable.mockResolvedValue(false);
      configure.mockResolvedValue("memory");

      const result = await configureDbStorage({ sessionHistory: false });

      expect(result).toBe("memory");
      expect(getAvailableStorageBytes).not.toHaveBeenCalled();
      expect(configure).toHaveBeenCalledWith({
        mode: "memory",
        sahpoolId: "tab-a",
        sessionHistory: false,
      });
      expect(captureWarning).toHaveBeenCalledWith(
        fallbackMessage("opfs-not-available"),
      );
    });
  });

  it("captures the effective mode", async () => {
    isOPFSAvailable.mockResolvedValue(true);
    configure.mockResolvedValueOnce("sahpool");

    await configureDbStorage({ sessionHistory: false });

    expect(captureInfo).toHaveBeenCalledTimes(1);
  });

  it("protects every recoverable pool from cleanup", async () => {
    isOPFSAvailable.mockResolvedValue(true);
    configure.mockResolvedValueOnce("sahpool");
    readRecoveryFingerprints.mockReturnValue([
      { poolId: "crashed-tab" },
      { poolId: "another-crashed-tab" },
    ]);

    await configureDbStorage({ sessionHistory: false });

    expect(configure).toHaveBeenCalledWith({
      mode: "sahpool",
      sahpoolId: "tab-a",
      sessionHistory: false,
    });
    expect(cleanupStaleDbPools).toHaveBeenCalledWith(
      "tab-a",
      ["crashed-tab", "another-crashed-tab"],
      expect.any(Function),
    );
  });

  it("rotates the appId so the live pool never reuses a recoverable pool", async () => {
    isOPFSAvailable.mockResolvedValue(true);
    configure.mockResolvedValueOnce("sahpool");
    readRecoveryFingerprints.mockReturnValue([
      { poolId: "other-tab" },
      { poolId: "tab-a" },
    ]);

    await configureDbStorage({ sessionHistory: false });

    expect(resetAppId).toHaveBeenCalledTimes(1);
    expect(configure).toHaveBeenCalledWith({
      mode: "sahpool",
      sahpoolId: "tab-a-fresh",
      sessionHistory: false,
    });
    expect(cleanupStaleDbPools).toHaveBeenCalledWith(
      "tab-a-fresh",
      ["other-tab", "tab-a"],
      expect.any(Function),
    );
  });

  it("rotates the appId before installing when another live tab holds it", async () => {
    isOPFSAvailable.mockResolvedValue(true);
    isSessionAlive.mockResolvedValueOnce(true);
    configure.mockResolvedValueOnce("sahpool");

    const result = await configureDbStorage({ sessionHistory: false });

    expect(result).toBe("sahpool");
    expect(isSessionAlive).toHaveBeenCalledWith("tab-a");
    expect(resetAppId).toHaveBeenCalledTimes(1);
    expect(configure).toHaveBeenCalledTimes(1);
    expect(configure).toHaveBeenCalledWith({
      mode: "sahpool",
      sahpoolId: "tab-a-fresh",
      sessionHistory: false,
    });
    expect(holdSessionLock).toHaveBeenCalledWith("tab-a-fresh");
  });

  it("holds the session lock whenever sahpool is effective", async () => {
    isOPFSAvailable.mockResolvedValue(true);
    configure.mockResolvedValueOnce("sahpool");

    await configureDbStorage({ sessionHistory: false });

    expect(holdSessionLock).toHaveBeenCalledTimes(1);
    expect(holdSessionLock).toHaveBeenCalledWith("tab-a");
  });

  it("does not hold the session lock when falling back to memory", async () => {
    isOPFSAvailable.mockResolvedValue(true);
    configure.mockResolvedValue("memory");

    await configureDbStorage({ sessionHistory: false });

    expect(holdSessionLock).not.toHaveBeenCalled();
  });

  it("does not probe the session lock when OPFS is unavailable", async () => {
    isOPFSAvailable.mockResolvedValue(false);
    configure.mockResolvedValueOnce("memory");

    await configureDbStorage({ sessionHistory: false });

    expect(isSessionAlive).not.toHaveBeenCalled();
    expect(holdSessionLock).not.toHaveBeenCalled();
  });
});
