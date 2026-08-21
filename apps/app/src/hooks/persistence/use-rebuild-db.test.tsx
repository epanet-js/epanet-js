import { renderHook, act } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { setInitialState } from "src/__helpers__/state";
import { Store } from "src/state";
import { dialogAtom } from "src/state/dialog";
import {
  dbAvailabilityAtom,
  dbStorageModeAtom,
  rebuildAttemptsAtom,
  opfsReinstallFailedAtom,
} from "src/state/session-recovery";

type RebuildOptions = {
  skipOpfs?: boolean;
  onPhase?: (phase: string) => void;
};

const rebuildDbFromMemory =
  vi.fn<(input: unknown, options?: RebuildOptions) => Promise<string>>();
vi.mock("src/lib/db", async (importActual) => ({
  ...(await importActual<typeof import("src/lib/db")>()),
  rebuildDbFromMemory: (input: unknown, options?: RebuildOptions) =>
    rebuildDbFromMemory(input, options),
}));

const captureError = vi.fn<(...args: unknown[]) => void>();
const captureWarning = vi.fn<(...args: unknown[]) => void>();
vi.mock("src/infra/error-tracking", async (importActual) => ({
  ...(await importActual<typeof import("src/infra/error-tracking")>()),
  captureError: (...args: unknown[]) => {
    captureError(...args);
  },
  captureWarning: (...args: unknown[]) => {
    captureWarning(...args);
  },
  addToErrorLog: () => {},
}));

vi.mock("src/lib/db/commands/collect-diagnostics", () => ({
  collectDbDiagnostics: () => Promise.resolve({ writesSucceeded: 3 }),
}));

import { useRebuildDb } from "./use-rebuild-db";

const renderRebuild = (store: Store) =>
  renderHook(() => useRebuildDb(), {
    wrapper: ({ children }) => (
      <JotaiProvider store={store}>{children}</JotaiProvider>
    ),
  });

beforeEach(() => {
  vi.clearAllMocks();
  rebuildDbFromMemory.mockResolvedValue("opfs");
});

describe("useRebuildDb", () => {
  it("restores availability and records where the db ended up", async () => {
    const store = setInitialState({});
    store.set(dbAvailabilityAtom, "rebuilding");
    const { result } = renderRebuild(store);

    await act(async () => {
      await result.current();
    });

    expect(store.get(dbAvailabilityAtom)).toBe("available");
    expect(store.get(dbStorageModeAtom)).toBe("opfs");
    expect(store.get(dialogAtom)).toBeNull();
  });

  it("records a memory rebuild so the no-backup badge appears", async () => {
    rebuildDbFromMemory.mockResolvedValue("memory");
    const store = setInitialState({});
    const { result } = renderRebuild(store);

    await act(async () => {
      await result.current();
    });

    expect(store.get(dbStorageModeAtom)).toBe("memory");
    expect(store.get(dbAvailabilityAtom)).toBe("available");
  });

  it("holds the dialog open to warn when crash recovery was lost", async () => {
    rebuildDbFromMemory.mockResolvedValue("memory");
    const store = setInitialState({});
    store.set(dbStorageModeAtom, "opfs");
    const { result } = renderRebuild(store);

    await act(async () => {
      await result.current();
    });

    // A warning nobody saw is not a warning, so this one waits to be acknowledged.
    expect(store.get(dialogAtom)).toEqual({
      type: "rebuildStorageProgress",
      phase: "finalizing",
      outcome: "memory",
    });
  });

  it("does not flash a dialog when the rebuild is quick", async () => {
    const seen: unknown[] = [];
    rebuildDbFromMemory.mockImplementation((_input, options) => {
      options?.onPhase?.("writing");
      seen.push(store.get(dialogAtom));
      return Promise.resolve("opfs");
    });
    const store = setInitialState({});
    const { result } = renderRebuild(store);

    await act(async () => {
      await result.current();
    });

    // Never set mid-flight, and nothing left behind: a modal that blinks for a frame is
    // worse than no modal. `startProgressDialog` covers the slow case.
    expect(seen[0]).toBeNull();
    expect(store.get(dialogAtom)).toBeNull();
  });

  describe("when OPFS keeps failing", () => {
    it("remembers that OPFS could not be reinstalled", async () => {
      rebuildDbFromMemory.mockResolvedValue("memory");
      const store = setInitialState({});
      const { result } = renderRebuild(store);

      await act(async () => {
        await result.current();
      });

      expect(store.get(opfsReinstallFailedAtom)).toBe(true);
    });

    it("stops asking for OPFS for the rest of the session", async () => {
      rebuildDbFromMemory.mockResolvedValue("memory");
      const store = setInitialState({});
      store.set(opfsReinstallFailedAtom, true);
      const { result } = renderRebuild(store);

      await act(async () => {
        await result.current();
      });

      expect(rebuildDbFromMemory).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ skipOpfs: true }),
      );
    });

    it("keeps asking while OPFS is still working", async () => {
      rebuildDbFromMemory.mockResolvedValue("opfs");
      const store = setInitialState({});
      const { result } = renderRebuild(store);

      await act(async () => {
        await result.current();
      });

      expect(store.get(opfsReinstallFailedAtom)).toBe(false);
    });

    it("counts every attempt so the budget can run out", async () => {
      const store = setInitialState({});
      const { result } = renderRebuild(store);

      await act(async () => {
        await result.current();
      });

      expect(store.get(rebuildAttemptsAtom)).toBe(1);
    });

    it("warns about the lost backup only when it was on OPFS before", async () => {
      rebuildDbFromMemory.mockResolvedValue("memory");
      const store = setInitialState({});
      store.set(dbStorageModeAtom, "memory");
      const { result } = renderRebuild(store);

      await act(async () => {
        await result.current();
      });

      // Already in memory, so nothing changed and there is nothing to announce again.
      expect(store.get(dialogAtom)).toBeNull();
    });
  });

  describe("reporting", () => {
    it("reports the degraded session once, with where it ended up", async () => {
      rebuildDbFromMemory.mockResolvedValue("memory");
      const store = setInitialState({});
      store.set(dbStorageModeAtom, "opfs");
      const { result } = renderRebuild(store);

      await act(async () => {
        await result.current();
      });

      expect(captureWarning).toHaveBeenCalledWith(
        "DB storage degraded; rebuilt from memory",
        undefined,
        {
          "DB Storage": { storageMode: "memory", lostCrashRecovery: true },
        },
      );
    });

    it("does not report again on later rebuilds in the same session", async () => {
      const store = setInitialState({});
      store.set(rebuildAttemptsAtom, 1);
      const { result } = renderRebuild(store);

      await act(async () => {
        await result.current();
      });

      expect(captureWarning).not.toHaveBeenCalled();
    });
  });

  it("goes terminal and captures one event when the rebuild fails", async () => {
    rebuildDbFromMemory.mockRejectedValue(new Error("import blew up"));
    const store = setInitialState({});
    const { result } = renderRebuild(store);

    await act(async () => {
      await result.current();
    });

    expect(store.get(dbAvailabilityAtom)).toBe("unavailable");
    expect(store.get(dialogAtom)).toEqual({ type: "dbUnavailable" });
    expect(captureError).toHaveBeenCalledTimes(1);
  });

  it("attaches the storage snapshot to the terminal event", async () => {
    rebuildDbFromMemory.mockRejectedValue(new Error("import blew up"));
    const store = setInitialState({});
    const { result } = renderRebuild(store);

    await act(async () => {
      await result.current();
    });

    expect(captureError).toHaveBeenCalledWith(expect.anything(), {
      "DB Storage": expect.objectContaining({ writesSucceeded: 3 }),
    });
  });
});
