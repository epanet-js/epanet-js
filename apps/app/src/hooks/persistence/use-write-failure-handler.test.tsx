import { renderHook, act } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { setInitialState } from "src/__helpers__/state";
import { Store } from "src/state";
import { sessionRecoveryActiveAtom } from "src/state/session-recovery";

const exportDb = vi.fn<() => Promise<Blob>>();
vi.mock("src/lib/db", async (importActual) => ({
  ...(await importActual<typeof import("src/lib/db")>()),
  exportDb: () => exportDb(),
}));

const openPersistedProject = vi.fn<() => Promise<{ status: string }>>();
vi.mock("src/hooks/persistence/use-open-persisted-project", () => ({
  useOpenPersistedProject: () => ({ openPersistedProject }),
}));

vi.mock("src/components/notifications", () => ({
  notify: () => {},
}));

const captureWarning = vi.fn<(...args: unknown[]) => void>();
const captureError = vi.fn<(...args: unknown[]) => void>();
vi.mock("src/infra/error-tracking", async (importActual) => ({
  ...(await importActual<typeof import("src/infra/error-tracking")>()),
  captureWarning: (...args: unknown[]) => {
    captureWarning(...args);
  },
  captureError: (...args: unknown[]) => {
    captureError(...args);
  },
}));

const collectDbDiagnostics = vi.fn<() => Promise<Record<string, unknown>>>();
vi.mock("src/lib/db/commands/collect-diagnostics", () => ({
  collectDbDiagnostics: () => collectDbDiagnostics(),
}));

import { useWriteFailureHandler } from "./use-write-failure-handler";

// The handler is synchronous and defers the report, so assertions have to wait for that
// chain rather than for the call itself.
const flushReport = () => new Promise((resolve) => setTimeout(resolve, 0));

const renderHandler = (store: Store) =>
  renderHook(() => useWriteFailureHandler(), {
    wrapper: ({ children }) => (
      <JotaiProvider store={store}>{children}</JotaiProvider>
    ),
  });

const aStoreWithRecovery = (): Store => {
  const store = setInitialState({});
  store.set(sessionRecoveryActiveAtom, true);
  return store;
};

beforeEach(() => {
  vi.clearAllMocks();
  exportDb.mockResolvedValue(new Blob(["db"]));
  openPersistedProject.mockResolvedValue({ status: "ok" });
  collectDbDiagnostics.mockResolvedValue({
    appId: "tab-a",
    writesSucceeded: 12,
    poolDirExists: true,
    storagePersisted: false,
  });
});

describe("useWriteFailureHandler diagnostics", () => {
  it("attaches a storage snapshot to the write-failure warning", async () => {
    const store = aStoreWithRecovery();
    const { result } = renderHandler(store);

    await act(async () => {
      result.current(new Error("SQLITE_IOERR: disk I/O error"));
      await flushReport();
    });

    expect(captureWarning).toHaveBeenCalledWith(
      "DB write failed; recovering model from persisted DB",
      expect.anything(),
      {
        "DB Storage": expect.objectContaining({
          writesSucceeded: 12,
          storagePersisted: false,
        }),
      },
    );
  });

  it("attaches a storage snapshot when the recovery reload fails", async () => {
    const store = aStoreWithRecovery();
    openPersistedProject.mockResolvedValue({ status: "corrupt" });
    const { result } = renderHandler(store);

    await act(async () => {
      result.current(new Error("SQLITE_IOERR: disk I/O error"));
      await flushReport();
    });

    expect(captureError).toHaveBeenCalledWith(expect.anything(), {
      "DB Storage": expect.objectContaining({ writesSucceeded: 12 }),
    });
  });

  it("still reports if collecting the snapshot fails", async () => {
    const store = aStoreWithRecovery();
    collectDbDiagnostics.mockRejectedValue(new Error("probe exploded"));
    const { result } = renderHandler(store);

    await act(async () => {
      result.current(new Error("SQLITE_IOERR: disk I/O error"));
      await flushReport();
    });

    expect(captureWarning).toHaveBeenCalledWith(
      "DB write failed; recovering model from persisted DB",
      expect.anything(),
      undefined,
    );
  });

  it("does not report when recovery is inactive", () => {
    const store = setInitialState({});
    const { result } = renderHandler(store);

    expect(() => result.current(new Error("boom"))).toThrow("boom");
    expect(captureWarning).not.toHaveBeenCalled();
  });
});
