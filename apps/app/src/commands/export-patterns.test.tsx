import { renderHook, act } from "@testing-library/react";
import { vi } from "vitest";
import { createStore, Provider as JotaiProvider } from "jotai";
import type { PatternType, Patterns } from "src/hydraulic-model";
import { projectFileInfoAtom } from "src/state/file-system";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import type { ExportPatternsOptions } from "src/lib/operational-data-io/patterns/export-patterns";
import { useExportPatterns } from "./export-patterns";

vi.mock("src/infra/storage/file-system-helpers", () => ({
  FileSystemHelpers: {
    downloadFile: vi.fn(() => Promise.resolve()),
  },
}));

import { FileSystemHelpers } from "src/infra/storage/file-system-helpers";

const downloadFile = vi.mocked(FileSystemHelpers.downloadFile);

const patterns: Patterns = new Map([
  [
    1,
    { id: 1, label: "PAT1", type: "demand" as PatternType, multipliers: [1] },
  ],
]);

const options: ExportPatternsOptions = {
  typeLabels: {
    demand: "Demand",
    reservoirHead: "Reservoir head",
    pumpSpeed: "Pump speed",
    qualitySourceStrength: "Quality source strength",
    energyPrice: "Energy price",
  },
  intervalSeconds: 3600,
  headers: {
    patternName: "Pattern name",
    type: "Type",
    interval: "Interval",
    multipliers: "Multipliers",
  },
};

const renderExport = (store: ReturnType<typeof createStore>) =>
  renderHook(() => useExportPatterns(), {
    wrapper: ({ children }) => (
      <JotaiProvider store={store}>{children}</JotaiProvider>
    ),
  });

const storeWithFileName = (name: string) => {
  const store = createStore();
  store.set(projectFileInfoAtom, { name, modelVersion: "1" });
  return store;
};

describe("useExportPatterns", () => {
  let tracking: ReturnType<typeof stubUserTracking>;

  beforeEach(() => {
    vi.clearAllMocks();
    tracking = stubUserTracking();
  });

  it("writes a CSV named after the network and tracks the export", async () => {
    const { result } = renderExport(storeWithFileName("my-network.inp"));

    await act(async () => {
      await result.current.exportToCsv(patterns, options);
    });

    const [fileName, contents] = downloadFile.mock.calls[0];
    expect(fileName).toEqual("my-network-patterns.csv");
    expect(typeof contents).toBe("string");
    expect(tracking.capture).toHaveBeenCalledWith({
      name: "patterns.exported",
      format: "csv",
      count: 1,
    });
  });

  it("writes an XLSX named after the network and tracks the export", async () => {
    const { result } = renderExport(storeWithFileName("my-network.inp"));

    await act(async () => {
      await result.current.exportToXlsx(patterns, options);
    });

    const [fileName, contents] = downloadFile.mock.calls[0];
    expect(fileName).toEqual("my-network-patterns.xlsx");
    expect(typeof contents).not.toBe("string");
    expect((contents as Uint8Array).byteLength).toBeGreaterThan(0);
    expect(tracking.capture).toHaveBeenCalledWith({
      name: "patterns.exported",
      format: "xlsx",
      count: 1,
    });
  });
});
