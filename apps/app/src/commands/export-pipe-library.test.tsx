import { renderHook, act } from "@testing-library/react";
import { vi } from "vitest";
import { createStore, Provider as JotaiProvider } from "jotai";
import type { PipeMaterial } from "@epanet-js/hydraulic-model";
import { projectFileInfoAtom } from "src/state/file-system";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { useExportPipeLibrary } from "./export-pipe-library";

vi.mock("src/infra/storage/file-system-helpers", () => ({
  FileSystemHelpers: {
    downloadFile: vi.fn(() => Promise.resolve()),
  },
}));

import { FileSystemHelpers } from "src/infra/storage/file-system-helpers";

const downloadFile = vi.mocked(FileSystemHelpers.downloadFile);

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
  store.set(projectFileInfoAtom, { name });
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

    const [fileName, contents] = downloadFile.mock.calls[0];
    expect(fileName).toEqual("my-network-pipe-library.csv");
    expect(typeof contents).toBe("string");
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

    const [fileName, contents] = downloadFile.mock.calls[0];
    expect(fileName).toEqual("my-network-pipe-library.xlsx");
    expect(typeof contents).not.toBe("string");
    expect((contents as Uint8Array).byteLength).toBeGreaterThan(0);
    expect(tracking.capture).toHaveBeenCalledWith({
      name: "pipeLibrary.exported",
      format: "xlsx",
    });
  });
});
