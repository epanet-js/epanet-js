import { renderHook, act } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { setInitialState } from "src/__helpers__/state";
import { Store } from "src/state";
import { dialogAtom } from "src/state/dialog";
import {
  dbAvailabilityAtom,
  dbStorageModeAtom,
  rebuildAttemptsAtom,
  writesSucceededAtRebuildAtom,
  MAX_REBUILD_ATTEMPTS,
} from "src/state/session-recovery";

const exportDb = vi.fn<() => Promise<Blob>>();
vi.mock("src/lib/db", async (importActual) => ({
  ...(await importActual<typeof import("src/lib/db")>()),
  exportDb: () => exportDb(),
}));

const openPersistedProject = vi.fn<() => Promise<{ status: string }>>();
vi.mock("src/hooks/persistence/use-open-persisted-project", () => ({
  useOpenPersistedProject: () => ({ openPersistedProject }),
}));

const rebuildDb = vi.fn<() => Promise<void>>();
vi.mock("src/hooks/persistence/use-rebuild-db", () => ({
  useRebuildDb: () => rebuildDb,
}));

const notify = vi.fn<(args: unknown) => void>();
vi.mock("src/components/notifications", () => ({
  notify: (args: unknown) => {
    notify(args);
  },
}));

const clearRecoveryFingerprint = vi.fn<(poolId: string) => void>();
vi.mock("src/infra/session-recovery", async (importActual) => ({
  ...(await importActual<typeof import("src/infra/session-recovery")>()),
  clearRecoveryFingerprint: (poolId: string) => {
    clearRecoveryFingerprint(poolId);
  },
}));

vi.mock("src/infra/app-instance", async (importActual) => ({
  ...(await importActual<typeof import("src/infra/app-instance")>()),
  getAppId: () => "tab-a",
}));

const addToErrorLog = vi.fn<(crumb: unknown) => void>();
const captureError = vi.fn<(...args: unknown[]) => void>();
const captureWarning = vi.fn<(...args: unknown[]) => void>();
vi.mock("src/infra/error-tracking", async (importActual) => ({
  ...(await importActual<typeof import("src/infra/error-tracking")>()),
  addToErrorLog: (crumb: unknown) => {
    addToErrorLog(crumb);
  },
  captureError: (...args: unknown[]) => {
    captureError(...args);
  },
  captureWarning: (...args: unknown[]) => {
    captureWarning(...args);
  },
}));

import { useWriteFailureHandler } from "./use-write-failure-handler";

// The handler is synchronous and kicks the follow-up off as a floating promise, so
// assertions have to wait for that chain rather than for the call itself.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const renderHandler = (store: Store) =>
  renderHook(() => useWriteFailureHandler(), {
    wrapper: ({ children }) => (
      <JotaiProvider store={store}>{children}</JotaiProvider>
    ),
  });

const anOpfsStore = (): Store => {
  const store = setInitialState({});
  store.set(dbStorageModeAtom, "opfs");
  return store;
};

const aMemoryStore = (): Store => {
  const store = setInitialState({});
  store.set(dbStorageModeAtom, "memory");
  return store;
};

const unreadable = () => new Error("SQLITE_IOERR: disk I/O error");

beforeEach(() => {
  vi.clearAllMocks();
  exportDb.mockResolvedValue(new Blob(["db"]));
  openPersistedProject.mockResolvedValue({ status: "ok" });
  rebuildDb.mockResolvedValue(undefined);
});

describe("useWriteFailureHandler", () => {
  describe("when the db reports itself unreadable", () => {
    it("rebuilds on the first failure rather than waiting for a second", async () => {
      const store = anOpfsStore();
      const { result } = renderHandler(store);

      await act(async () => {
        result.current(unreadable());
        await flush();
      });

      expect(rebuildDb).toHaveBeenCalledTimes(1);
      expect(store.get(dbAvailabilityAtom)).toBe("rebuilding");
    });

    it("never reads through the db it just declared unreadable", async () => {
      const store = anOpfsStore();
      const { result } = renderHandler(store);

      await act(async () => {
        result.current(new Error("[applyMoment] No database open"));
        await flush();
      });

      expect(exportDb).not.toHaveBeenCalled();
      expect(openPersistedProject).not.toHaveBeenCalled();
    });

    it("withdraws the stale pool as a recovery offer", async () => {
      const store = anOpfsStore();
      const { result } = renderHandler(store);

      await act(async () => {
        result.current(unreadable());
        await flush();
      });

      expect(clearRecoveryFingerprint).toHaveBeenCalledWith("tab-a");
    });

    it("rebuilds even when storage was already in memory", async () => {
      const store = aMemoryStore();
      const { result } = renderHandler(store);

      await act(async () => {
        result.current(unreadable());
        await flush();
      });

      expect(rebuildDb).toHaveBeenCalledTimes(1);
    });

    it("reports a breadcrumb, not an event", async () => {
      const store = anOpfsStore();
      const { result } = renderHandler(store);

      await act(async () => {
        result.current(unreadable());
        await flush();
      });

      expect(addToErrorLog).toHaveBeenCalledTimes(1);
      expect(captureError).not.toHaveBeenCalled();
      expect(captureWarning).not.toHaveBeenCalled();
    });
  });

  describe("when rebuilding has not helped", () => {
    it("blocks the app when a write fails again after a rebuild", async () => {
      const store = anOpfsStore();
      store.set(rebuildAttemptsAtom, MAX_REBUILD_ATTEMPTS);
      const { result } = renderHandler(store);

      await act(async () => {
        result.current(unreadable());
        await flush();
      });

      // The DB was already rebuilt once; rebuilding it again would not help.
      expect(rebuildDb).not.toHaveBeenCalled();
      expect(store.get(dbAvailabilityAtom)).toBe("unavailable");
      expect(store.get(dialogAtom)).toEqual({ type: "dbUnavailable" });
    });

    it("rebuilds again when a write has succeeded since the last one", async () => {
      const store = anOpfsStore();
      store.set(rebuildAttemptsAtom, MAX_REBUILD_ATTEMPTS);
      // The rebuilt db took a write, so this failure is not the second in a row.
      store.set(writesSucceededAtRebuildAtom, -1);
      const { result } = renderHandler(store);

      await act(async () => {
        result.current(unreadable());
        await flush();
      });

      expect(rebuildDb).toHaveBeenCalledTimes(1);
      expect(store.get(dbAvailabilityAtom)).toBe("rebuilding");
    });

    it("rebuilds on the first failure", async () => {
      const store = anOpfsStore();
      store.set(rebuildAttemptsAtom, MAX_REBUILD_ATTEMPTS - 1);
      const { result } = renderHandler(store);

      await act(async () => {
        result.current(unreadable());
        await flush();
      });

      expect(rebuildDb).toHaveBeenCalledTimes(1);
    });
  });

  describe("the latch", () => {
    it("responds once no matter how many writes fail afterwards", async () => {
      const store = anOpfsStore();
      const { result } = renderHandler(store);

      await act(async () => {
        result.current(unreadable());
        result.current(unreadable());
        result.current(unreadable());
        await flush();
      });

      expect(rebuildDb).toHaveBeenCalledTimes(1);
      expect(addToErrorLog).toHaveBeenCalledTimes(1);
    });

    it("absorbs failures instead of rethrowing once the db is unavailable", () => {
      const store = anOpfsStore();
      store.set(dbAvailabilityAtom, "unavailable");
      const { result } = renderHandler(store);

      expect(() => result.current(unreadable())).not.toThrow();
      expect(rebuildDb).not.toHaveBeenCalled();
    });
  });

  describe("when the db is still readable", () => {
    it("reloads the model and only then reports it recovered", async () => {
      const store = anOpfsStore();
      const { result } = renderHandler(store);

      await act(async () => {
        result.current(new Error("UNIQUE constraint failed"));
        await flush();
      });

      expect(openPersistedProject).toHaveBeenCalledTimes(1);
      expect(store.get(dbAvailabilityAtom)).toBe("available");
      expect(notify).toHaveBeenCalledTimes(1);
    });

    it("falls back to a rebuild when the reload fails", async () => {
      const store = anOpfsStore();
      openPersistedProject.mockResolvedValue({ status: "corrupt" });
      const { result } = renderHandler(store);

      await act(async () => {
        result.current(new Error("UNIQUE constraint failed"));
        await flush();
      });

      expect(rebuildDb).toHaveBeenCalledTimes(1);
      expect(notify).not.toHaveBeenCalled();
    });

    it("rethrows when there is no pool to reload from", () => {
      const store = aMemoryStore();
      const { result } = renderHandler(store);

      expect(() =>
        result.current(new Error("UNIQUE constraint failed")),
      ).toThrow("UNIQUE constraint failed");
      expect(rebuildDb).not.toHaveBeenCalled();
    });
  });
});
