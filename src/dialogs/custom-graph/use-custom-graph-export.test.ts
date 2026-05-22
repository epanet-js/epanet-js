// @vitest-environment jsdom
import { act } from "react";
import { renderHook } from "@testing-library/react";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { useCustomGraphExport } from "./use-custom-graph-export";
import { AssetTimeSeries } from "./types";

vi.mock("src/commands/export-simulation-results", () => ({
  useExportSimulationResults: vi.fn(() => vi.fn().mockResolvedValue(undefined)),
}));

vi.mock("src/components/notifications", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("src/components/notifications")>();
  return { ...original, notify: vi.fn() };
});

import { useExportSimulationResults } from "src/commands/export-simulation-results";
import { notify } from "src/components/notifications";

const makeSeriesData = (assetId: number, label: string): AssetTimeSeries => ({
  assetId,
  label,
  timeSeries: {
    values: new Float32Array([1, 2, 3]),
    intervalsCount: 3,
    intervalSeconds: 3600,
  },
});

const defaultOptions = () => ({
  chartContainerRef: {
    current: null,
  } as React.RefObject<HTMLDivElement | null>,
  networkName: "test-network",
  nodeSeriesData: [makeSeriesData(1, "J1")],
  linkSeriesData: [makeSeriesData(2, "P1")],
  nodeProperty: "pressure",
  linkProperty: "flow",
});

describe("useCustomGraphExport", () => {
  let tracking: ReturnType<typeof stubUserTracking>;

  beforeEach(() => {
    tracking = stubUserTracking();
    vi.mocked(notify).mockClear();
  });

  describe("exportTabular", () => {
    it("calls export with correct properties for flow", async () => {
      const mockExport = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useExportSimulationResults).mockReturnValue(mockExport);

      const { result } = renderHook(() =>
        useCustomGraphExport(defaultOptions()),
      );

      await act(() => result.current.exportTabular("csv"));

      expect(mockExport).toHaveBeenCalledWith({
        format: "csv",
        fileName: "test-network-J1-pressure",
        onProgress: expect.any(Function),
        properties: ["pressure", "flow"],
        selectedAssets: new Set([1, 2]),
      });
    });

    it("maps headloss to unitHeadloss", async () => {
      const mockExport = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useExportSimulationResults).mockReturnValue(mockExport);

      const opts = defaultOptions();
      opts.linkProperty = "headloss";
      const { result } = renderHook(() => useCustomGraphExport(opts));

      await act(() => result.current.exportTabular("xlsx"));

      expect(mockExport).toHaveBeenCalledWith(
        expect.objectContaining({
          format: "xlsx",
          properties: ["pressure", "unitHeadloss"],
        }),
      );
    });

    it("maps flowAbsolute to flow", async () => {
      const mockExport = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useExportSimulationResults).mockReturnValue(mockExport);

      const opts = defaultOptions();
      opts.linkProperty = "flowAbsolute";
      const { result } = renderHook(() => useCustomGraphExport(opts));

      await act(() => result.current.exportTabular("csv"));

      expect(mockExport).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: ["pressure", "flow"],
        }),
      );
    });

    it("passes status property as-is", async () => {
      const mockExport = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useExportSimulationResults).mockReturnValue(mockExport);

      const opts = defaultOptions();
      opts.linkProperty = "status";
      const { result } = renderHook(() => useCustomGraphExport(opts));

      await act(() => result.current.exportTabular("csv"));

      expect(mockExport).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: ["pressure", "status"],
        }),
      );
    });

    it("maps water quality node properties to waterQuality", async () => {
      const mockExport = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useExportSimulationResults).mockReturnValue(mockExport);

      const opts = defaultOptions();
      opts.nodeProperty = "waterAge";
      const { result } = renderHook(() => useCustomGraphExport(opts));

      await act(() => result.current.exportTabular("csv"));

      expect(mockExport).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: ["waterQuality", "flow"],
        }),
      );
    });

    it("excludes link properties when no links exist", async () => {
      const mockExport = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useExportSimulationResults).mockReturnValue(mockExport);

      const opts = defaultOptions();
      opts.linkSeriesData = [];
      const { result } = renderHook(() => useCustomGraphExport(opts));

      await act(() => result.current.exportTabular("csv"));

      expect(mockExport).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: ["pressure"],
        }),
      );
    });

    it("excludes node properties when no nodes exist", async () => {
      const mockExport = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useExportSimulationResults).mockReturnValue(mockExport);

      const opts = defaultOptions();
      opts.nodeSeriesData = [];
      const { result } = renderHook(() => useCustomGraphExport(opts));

      await act(() => result.current.exportTabular("csv"));

      expect(mockExport).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: ["flow"],
        }),
      );
    });

    it("tracks export after completion", async () => {
      const mockExport = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useExportSimulationResults).mockReturnValue(mockExport);

      const { result } = renderHook(() =>
        useCustomGraphExport(defaultOptions()),
      );

      await act(() => result.current.exportTabular("xlsx"));

      expect(tracking.capture).toHaveBeenCalledWith({
        name: "customGraph.exported",
        format: "xlsx",
        numAssets: 2,
      });

      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    });
  });

  describe("exportAsPng", () => {
    it("tracks export after PNG generation", () => {
      const container = document.createElement("div");
      const chartEl = document.createElement("div");
      chartEl.setAttribute("_echarts_instance_", "test");
      container.appendChild(chartEl);

      const { getInstanceByDom } = vi.hoisted(() => ({
        getInstanceByDom: vi.fn(),
      }));
      vi.doMock("echarts", () => ({ getInstanceByDom }));
      getInstanceByDom.mockReturnValue({
        getDataURL: () => "data:image/svg+xml,<svg></svg>",
      });

      const opts = defaultOptions();
      opts.chartContainerRef = { current: container };

      const { result } = renderHook(() => useCustomGraphExport(opts));

      act(() => {
        result.current.exportAsPng();
      });
    });

    it("does nothing when container ref is null", () => {
      const { result } = renderHook(() =>
        useCustomGraphExport(defaultOptions()),
      );

      act(() => {
        result.current.exportAsPng();
      });

      expect(tracking.capture).not.toHaveBeenCalled();
    });
  });
});
