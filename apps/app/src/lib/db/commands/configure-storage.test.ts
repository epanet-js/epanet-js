import { describe, it, expect, vi, beforeEach } from "vitest";

const configure = vi.fn();
const cleanupStaleDbPools =
  vi.fn<(appId: string, protectedIds: string[]) => Promise<void>>();
vi.mock("@epanet-js/ejsdb", async (importActual) => ({
  ...(await importActual<typeof import("@epanet-js/ejsdb")>()),
  getWorker: () => ({ configure }),
  cleanupStaleDbPools: (appId: string, protectedIds: string[]) =>
    cleanupStaleDbPools(appId, protectedIds),
}));

const readRecoveryFingerprints = vi.fn<() => { poolId: string }[]>(() => []);
vi.mock("src/infra/session-recovery", () => ({
  readRecoveryFingerprints: () => readRecoveryFingerprints(),
}));

const isOPFSAvailable = vi.fn<() => Promise<boolean>>();
vi.mock("src/infra/storage", async (importActual) => ({
  ...(await importActual<typeof import("src/infra/storage")>()),
  isOPFSAvailable: () => isOPFSAvailable(),
}));

const getAppId = vi.fn(() => "tab-a");
const resetAppId = vi.fn(() => "tab-a-fresh");
vi.mock("src/infra/app-instance", () => ({
  getAppId: () => getAppId(),
  resetAppId: () => resetAppId(),
}));

const captureWarning = vi.fn<(message: string) => void>();
const captureInfo = vi.fn<(message: string) => void>();
vi.mock("src/infra/error-tracking", async (importActual) => ({
  ...(await importActual<typeof import("src/infra/error-tracking")>()),
  captureWarning: (message: string) => captureWarning(message),
  captureInfo: (message: string) => captureInfo(message),
}));

import { configureDbStorage } from "./configure-storage";

beforeEach(() => {
  vi.clearAllMocks();
  readRecoveryFingerprints.mockReturnValue([]);
});

describe("configureDbStorage", () => {
  it("regenerates the appId and retries once when the sahpool install clashes", async () => {
    isOPFSAvailable.mockResolvedValue(true);
    configure.mockResolvedValueOnce("memory").mockResolvedValueOnce("sahpool");

    const result = await configureDbStorage(true, false);

    expect(result).toBe("sahpool");
    expect(configure).toHaveBeenNthCalledWith(1, {
      mode: "sahpool",
      sahpoolId: "tab-a",
    });
    expect(resetAppId).toHaveBeenCalledTimes(1);
    expect(configure).toHaveBeenNthCalledWith(2, {
      mode: "sahpool",
      sahpoolId: "tab-a-fresh",
    });
    expect(cleanupStaleDbPools).toHaveBeenCalledWith("tab-a-fresh", []);
    expect(captureWarning).not.toHaveBeenCalled();
  });

  it("does not retry when the first sahpool install succeeds", async () => {
    isOPFSAvailable.mockResolvedValue(true);
    configure.mockResolvedValueOnce("sahpool");

    await configureDbStorage(true, false);

    expect(configure).toHaveBeenCalledTimes(1);
    expect(resetAppId).not.toHaveBeenCalled();
    expect(cleanupStaleDbPools).toHaveBeenCalledWith("tab-a", []);
  });

  it("warns and stays in memory when the retry also fails", async () => {
    isOPFSAvailable.mockResolvedValue(true);
    configure.mockResolvedValue("memory");

    const result = await configureDbStorage(true, false);

    expect(result).toBe("memory");
    expect(configure).toHaveBeenCalledTimes(2);
    expect(captureWarning).toHaveBeenCalledTimes(1);
    expect(cleanupStaleDbPools).not.toHaveBeenCalled();
  });

  it("returns memory without touching the worker when the flag is off", async () => {
    const result = await configureDbStorage(false, false);

    expect(result).toBe("memory");
    expect(isOPFSAvailable).not.toHaveBeenCalled();
    expect(configure).not.toHaveBeenCalled();
    expect(resetAppId).not.toHaveBeenCalled();
    expect(cleanupStaleDbPools).not.toHaveBeenCalled();
  });

  it("captures the effective mode only when the flag is on", async () => {
    isOPFSAvailable.mockResolvedValue(true);
    configure.mockResolvedValueOnce("sahpool");

    await configureDbStorage(true, false);

    expect(captureInfo).toHaveBeenCalledTimes(1);
  });

  it("does not capture the effective mode when the flag is off", async () => {
    await configureDbStorage(false, false);

    expect(captureInfo).not.toHaveBeenCalled();
  });

  it("protects every recoverable pool from cleanup when recovery is enabled", async () => {
    isOPFSAvailable.mockResolvedValue(true);
    configure.mockResolvedValueOnce("sahpool");
    readRecoveryFingerprints.mockReturnValue([
      { poolId: "crashed-tab" },
      { poolId: "another-crashed-tab" },
    ]);

    await configureDbStorage(true, true);

    expect(configure).toHaveBeenCalledWith({
      mode: "sahpool",
      sahpoolId: "tab-a",
    });
    expect(cleanupStaleDbPools).toHaveBeenCalledWith("tab-a", [
      "crashed-tab",
      "another-crashed-tab",
    ]);
  });

  it("rotates the appId so the live pool never reuses a recoverable pool", async () => {
    isOPFSAvailable.mockResolvedValue(true);
    configure.mockResolvedValueOnce("sahpool");
    readRecoveryFingerprints.mockReturnValue([
      { poolId: "other-tab" },
      { poolId: "tab-a" },
    ]);

    await configureDbStorage(true, true);

    expect(resetAppId).toHaveBeenCalledTimes(1);
    expect(configure).toHaveBeenCalledWith({
      mode: "sahpool",
      sahpoolId: "tab-a-fresh",
    });
    expect(cleanupStaleDbPools).toHaveBeenCalledWith("tab-a-fresh", [
      "other-tab",
      "tab-a",
    ]);
  });

  it("ignores the fingerprints when recovery is disabled", async () => {
    isOPFSAvailable.mockResolvedValue(true);
    configure.mockResolvedValueOnce("sahpool");
    readRecoveryFingerprints.mockReturnValue([{ poolId: "crashed-tab" }]);

    await configureDbStorage(true, false);

    expect(readRecoveryFingerprints).not.toHaveBeenCalled();
    expect(cleanupStaleDbPools).toHaveBeenCalledWith("tab-a", []);
  });
});
