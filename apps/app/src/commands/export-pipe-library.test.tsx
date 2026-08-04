import { renderHook, act } from "@testing-library/react";
import { vi } from "vitest";
import { createStore, Provider as JotaiProvider } from "jotai";
import type { PipeMaterial } from "@epanet-js/hydraulic-model";
import { projectFileInfoAtom } from "src/state/file-system";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { useExportPipeLibrary } from "./export-pipe-library";

const mockWrite = vi.fn<(data: string | Uint8Array) => Promise<void>>();
const mockClose = vi.fn<() => Promise<void>>();
const mockHandle = {
  createWritable: vi.fn(() =>
    Promise.resolve({ write: mockWrite, close: mockClose }),
  ),
} as unknown as FileSystemFileHandle;

vi.mock("src/lib/export/file-system-helpers", () => ({
  FileSystemHelpers: {
    openFileInOpfs: vi.fn(() => Promise.resolve(mockHandle)),
    triggerDownload: vi.fn(() => Promise.resolve()),
  },
}));

import { FileSystemHelpers } from "src/lib/export/file-system-helpers";

const materials: PipeMaterial[] = [
  { label: "Cast Iron", entries: [{ age: 0, roughness: 100 }] },
];

const renderExport = (store: ReturnType<typeof createStore>) =>
  renderHook(() => useExportPipeLibrary(), {
    wrapper: ({ children }) => (
      <JotaiProvider store={store}>{children}</JotaiProvider>
    ),
  });

const storeWithFileName = (name: string) => {
  const store = createStore();
  store.set(projectFileInfoAtom, { name, modelVersion: "1" });
  return store;
};

describe("useExportPipeLibrary", () => {
  let tracking: ReturnType<typeof stubUserTracking>;

  beforeEach(() => {
    vi.clearAllMocks();
    tracking = stubUserTracking();
  });

  it("writes a CSV named after the network and tracks the export", async () => {
    const { result } = renderExport(storeWithFileName("my-network.inp"));

    await act(async () => {
      await result.current.exportToCsv(materials);
    });

    expect(FileSystemHelpers.openFileInOpfs).toHaveBeenCalledWith(
      "my-network-pipe-library.csv",
    );
    expect(typeof mockWrite.mock.calls[0][0]).toBe("string");
    expect(FileSystemHelpers.triggerDownload).toHaveBeenCalledWith(
      "my-network-pipe-library.csv",
      mockHandle,
    );
    expect(tracking.capture).toHaveBeenCalledWith({
      name: "pipeLibrary.exported",
      format: "csv",
    });
  });

  it("writes an XLSX named after the network and tracks the export", async () => {
    const { result } = renderExport(storeWithFileName("my-network.inp"));

    await act(async () => {
      await result.current.exportToXlsx(materials);
    });

    expect(FileSystemHelpers.openFileInOpfs).toHaveBeenCalledWith(
      "my-network-pipe-library.xlsx",
    );
    expect(FileSystemHelpers.triggerDownload).toHaveBeenCalledWith(
      "my-network-pipe-library.xlsx",
      mockHandle,
    );
    expect(tracking.capture).toHaveBeenCalledWith({
      name: "pipeLibrary.exported",
      format: "xlsx",
    });
  });
});
