import { renderHook, act } from "@testing-library/react";
import { vi } from "vitest";
import type { CurveType, Curves } from "@epanet-js/hydraulic-model";
import { projectFileInfoAtom } from "src/state/file-system";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { createStore, Provider as JotaiProvider } from "jotai";
import type { ExportCurvesOptions } from "src/lib/operational-data-io/curves/export-curves";
import { useExportCurves } from "./export-curves";

vi.mock("src/infra/storage/file-system-helpers", () => ({
  FileSystemHelpers: {
    downloadFile: vi.fn(() => Promise.resolve()),
  },
}));

import { FileSystemHelpers } from "src/infra/storage/file-system-helpers";

const downloadFile = vi.mocked(FileSystemHelpers.downloadFile);

const typeLabels: Record<CurveType, string> = {
  pump: "Pump head",
  efficiency: "Pump efficiency",
  volume: "Tank volume",
  valve: "Valve",
  headloss: "Headloss",
};

const curves: Curves = new Map([
  [
    1,
    {
      id: 1,
      label: "C1",
      type: "volume" as CurveType,
      points: [{ x: 0, y: 1 }],
    },
  ],
]);

const options: ExportCurvesOptions = {
  scope: ["volume"],
  typeLabels,
  axisLabels: { x: "X", y: "Y" },
  headers: {
    curveName: "Curve name",
    type: "Type",
    axis: "Axis",
    values: "Values",
  },
};

const renderExport = (suffix: string) => {
  const store = createStore();
  store.set(projectFileInfoAtom, { name: "my-network.inp" });

  return renderHook(() => useExportCurves(suffix), {
    wrapper: ({ children }) => (
      <JotaiProvider store={store}>{children}</JotaiProvider>
    ),
  });
};

describe("useExportCurves", () => {
  let tracking: ReturnType<typeof stubUserTracking>;

  beforeEach(() => {
    vi.clearAllMocks();
    tracking = stubUserTracking();
  });

  it("names the file after the network and the given suffix", async () => {
    const { result } = renderExport("curves");

    await act(async () => {
      await result.current.exportToCsv(curves, options);
    });

    const [fileName, contents] = downloadFile.mock.calls[0];
    expect(fileName).toEqual("my-network-curves.csv");
    expect(typeof contents).toBe("string");
    expect(tracking.capture).toHaveBeenCalledWith({
      name: "curves.exported",
      format: "csv",
      count: 1,
    });
  });

  it("lets the pump library use its own suffix", async () => {
    const { result } = renderExport("pump-curves");

    await act(async () => {
      await result.current.exportToXlsx(curves, options);
    });

    const [fileName, contents] = downloadFile.mock.calls[0];
    expect(fileName).toEqual("my-network-pump-curves.xlsx");
    expect((contents as Uint8Array).byteLength).toBeGreaterThan(0);
  });
});
