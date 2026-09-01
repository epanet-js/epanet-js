import { renderHook, act } from "@testing-library/react";
import { vi } from "vitest";
import { createStore, Provider as JotaiProvider } from "jotai";
import { dialogAtom } from "src/state/dialog";
import { recoverableSessionsAtom } from "src/state/session-recovery";
import type { RecoveryFingerprint } from "src/infra/session-recovery";
import {
  useRecoverSession,
  useDiscardRecoverableSession,
  useIgnoreRecoverableSessions,
} from "./recover-session";

const capture = vi.fn();
vi.mock("src/infra/user-tracking", () => ({
  useUserTracking: () => ({ capture }),
}));

const exportDbFromPool = vi.fn<(poolId: string) => Promise<Blob>>();
vi.mock("src/lib/db", () => ({
  exportDbFromPool: (poolId: string) => exportDbFromPool(poolId),
}));

const openProjectFile =
  vi.fn<
    (
      file: File,
      source: string,
      options?: { isUnsaved?: boolean; lastSavedAt?: number },
    ) => Promise<void>
  >();
vi.mock("./open-project", () => ({
  useOpenProjectFile: () => openProjectFile,
}));

const cleanupStaleDbPools =
  vi.fn<
    (
      appId: string,
      survivingPoolIds: string[],
      isPoolInUse?: (id: string) => Promise<boolean>,
    ) => Promise<void>
  >();
vi.mock("@epanet-js/ejsdb", () => ({
  cleanupStaleDbPools: (
    appId: string,
    survivingPoolIds: string[],
    isPoolInUse?: (id: string) => Promise<boolean>,
  ) => cleanupStaleDbPools(appId, survivingPoolIds, isPoolInUse),
}));

const clearRecoveryFingerprints = vi.fn<(poolIds: string[]) => void>();
const readRecoveryFingerprints = vi.fn<() => RecoveryFingerprint[]>(() => []);
vi.mock("src/infra/session-recovery", () => ({
  clearRecoveryFingerprints: (poolIds: string[]) =>
    clearRecoveryFingerprints(poolIds),
  readRecoveryFingerprints: () => readRecoveryFingerprints(),
}));

vi.mock("src/components/notifications", () => ({ notify: vi.fn() }));

describe("recover session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exportDbFromPool.mockResolvedValue(new Blob(["db"]));
    openProjectFile.mockResolvedValue(undefined);
    cleanupStaleDbPools.mockResolvedValue(undefined);
    readRecoveryFingerprints.mockReturnValue([]);
  });

  it("clears only the recovered session and keeps the others", async () => {
    const store = storeWith([
      aSession({ poolId: "pool-1" }),
      aSession({ poolId: "pool-2" }),
    ]);
    readRecoveryFingerprints.mockReturnValue([aSession({ poolId: "pool-2" })]);

    const { result } = renderRecover(store, useRecoverSession);
    await act(async () => {
      await result.current(aSession({ poolId: "pool-1" }));
    });

    expect(openProjectFile).toHaveBeenCalledTimes(1);
    expect(clearRecoveryFingerprints).toHaveBeenCalledWith(["pool-1"]);
    expect(cleanupStaleDbPools).toHaveBeenCalledWith(
      expect.any(String),
      ["pool-2"],
      expect.anything(),
    );
    expect(capture).toHaveBeenCalledWith({
      name: "sessionRecovery.recovered",
      count: 2,
    });
  });

  it("keeps the other sessions when the recovery fails", async () => {
    const store = storeWith([
      aSession({ poolId: "pool-1" }),
      aSession({ poolId: "pool-2" }),
    ]);
    exportDbFromPool.mockRejectedValue(new Error("gone"));

    const { result } = renderRecover(store, useRecoverSession);
    await act(async () => {
      await result.current(aSession({ poolId: "pool-1" }));
    });

    expect(openProjectFile).not.toHaveBeenCalled();
    expect(clearRecoveryFingerprints).toHaveBeenCalledWith(["pool-1"]);
    expect(store.get(dialogAtom)).toEqual({ type: "welcome" });
    expect(capture).toHaveBeenCalledWith({ name: "sessionRecovery.failed" });
  });

  it("keeps every fingerprint when ignoring", () => {
    const store = storeWith([
      aSession({ poolId: "pool-1" }),
      aSession({ poolId: "pool-2" }),
    ]);

    const { result } = renderRecover(store, useIgnoreRecoverableSessions);
    act(() => {
      result.current();
    });

    expect(store.get(recoverableSessionsAtom)).toEqual([]);
    expect(clearRecoveryFingerprints).not.toHaveBeenCalled();
    expect(cleanupStaleDbPools).not.toHaveBeenCalled();
    expect(capture).toHaveBeenCalledWith({
      name: "sessionRecovery.ignored",
      count: 2,
    });
  });

  it("clears every fingerprint when discarding", () => {
    const store = storeWith([
      aSession({ poolId: "pool-1" }),
      aSession({ poolId: "pool-2" }),
    ]);

    const { result } = renderRecover(store, useDiscardRecoverableSession);
    act(() => {
      result.current();
    });

    expect(store.get(recoverableSessionsAtom)).toEqual([]);
    expect(clearRecoveryFingerprints).toHaveBeenCalledWith([
      "pool-1",
      "pool-2",
    ]);
    expect(capture).toHaveBeenCalledWith({ name: "sessionRecovery.discarded" });
  });
});

const storeWith = (sessions: RecoveryFingerprint[]) => {
  const store = createStore();
  store.set(recoverableSessionsAtom, sessions);
  return store;
};

const renderRecover = <T,>(
  store: ReturnType<typeof createStore>,
  useCommand: () => T,
) =>
  renderHook(() => useCommand(), {
    wrapper: ({ children }) => (
      <JotaiProvider store={store}>{children}</JotaiProvider>
    ),
  });

const aSession = (
  overrides: Partial<RecoveryFingerprint> = {},
): RecoveryFingerprint => ({
  poolId: "pool-1",
  projectName: "a-model",
  timestampLastModelChange: 1000,
  timestampLastSave: 500,
  ...overrides,
});
