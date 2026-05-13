import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { EPSResultsReader } from "src/simulation";
import { TimeSeries } from "src/simulation/epanet/eps-results-reader";
import { FileSystemHelpers } from "../file-system-helpers";
import { exportCsvSimulationResults } from "./export-csv-simulation-results";
import { NUM_DECIMAL_PLACES } from "../constants";

describe("exportTimeSeries", () => {
  beforeEach(() => {
    vi.spyOn(FileSystemHelpers, "isFileSystemAccessSupported").mockReturnValue(
      false,
    );
    vi.spyOn(FileSystemHelpers, "triggerDownload").mockResolvedValue(undefined);
  });

  it("creates one file per metric named with network name and metric", async () => {
    const IDS = { J1: 1 } as const;
    const model = HydraulicModelBuilder.with().aJunction(IDS.J1).build();
    const { dirHandle, getFileNames } = makeDirectory();
    const reader = makeResultsReader(1, 3600, {});

    await exportCsvSimulationResults("my-network", dirHandle, model, reader, {
      properties: ["pressure", "demand"],
    });

    expect(getFileNames()).toEqual([
      "my-network-export-pressure.csv",
      "my-network-export-demand.csv",
    ]);
  });

  it("writes header with id, type, and HH:MM timestep columns", async () => {
    const IDS = { J1: 1 } as const;
    const model = HydraulicModelBuilder.with().aJunction(IDS.J1).build();
    const { dirHandle, getText } = makeDirectory();
    const reader = makeResultsReader(2, 5400, {});

    await exportCsvSimulationResults("net", dirHandle, model, reader, {
      properties: ["pressure"],
    });

    const [header] = getText("net-export-pressure.csv").split("\n");
    expect(header).toBe("id,type,00:00,01:30");
  });

  it("writes node metrics only for nodes and link metrics only for links", async () => {
    const IDS = { J1: 1, P1: 2 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { label: "J1" })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, label: "P1" })
      .build();
    const { dirHandle, getText } = makeDirectory();
    const reader = makeResultsReader(1, 3600, {
      [`${IDS.J1}:pressure`]: makeTimeSeries([10]),
      [`${IDS.P1}:pressure`]: makeTimeSeries([99]),
      [`${IDS.J1}:flow`]: makeTimeSeries([99]),
      [`${IDS.P1}:flow`]: makeTimeSeries([5]),
    });

    await exportCsvSimulationResults("net", dirHandle, model, reader, {
      properties: ["pressure", "flow"],
    });

    const pressureLines = getText("net-export-pressure.csv")
      .split("\n")
      .filter(Boolean);
    expect(pressureLines).toHaveLength(2);
    expect(pressureLines[1]).toContain("J1");
    expect(pressureLines[1]).not.toContain("P1");

    const flowLines = getText("net-export-flow.csv")
      .split("\n")
      .filter(Boolean);
    expect(flowLines).toHaveLength(2);
    expect(flowLines[1]).toContain("P1");
    expect(flowLines[1]).not.toContain("J1");
  });

  it("maps status to closed when value is less than 3 and open when 3 or more", async () => {
    const IDS = { J1: 1, P1: 2, P2: 3 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, label: "P1" })
      .aPipe(IDS.P2, { startNodeId: IDS.J1, label: "P2" })
      .build();
    const { dirHandle, getText } = makeDirectory();
    const reader = makeResultsReader(1, 3600, {
      [`${IDS.P1}:status`]: makeTimeSeries([2]),
      [`${IDS.P2}:status`]: makeTimeSeries([3]),
    });

    await exportCsvSimulationResults("net", dirHandle, model, reader, {
      properties: ["status"],
    });

    const lines = getText("net-export-status.csv").split("\n").filter(Boolean);
    expect(lines[1]).toContain("closed");
    expect(lines[2]).toContain("open");
  });

  it(`formats numeric values with ${NUM_DECIMAL_PLACES} decimal places`, async () => {
    const IDS = { J1: 1 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { label: "J1" })
      .build();
    const { dirHandle, getText } = makeDirectory();
    const reader = makeResultsReader(1, 3600, {
      [`${IDS.J1}:pressure`]: makeTimeSeries([1.23456]),
    });

    await exportCsvSimulationResults("net", dirHandle, model, reader, {
      properties: ["pressure"],
    });

    const lines = getText("net-export-pressure.csv")
      .split("\n")
      .filter(Boolean);
    expect(lines[1]).toContain((1.23456).toFixed(NUM_DECIMAL_PLACES));
  });

  it("skips assets not in selection when selection is non-empty", async () => {
    const IDS = { J1: 1, J2: 2 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { label: "J1" })
      .aJunction(IDS.J2, { label: "J2" })
      .build();
    const { dirHandle, getText } = makeDirectory();
    const reader = makeResultsReader(1, 3600, {
      [`${IDS.J1}:pressure`]: makeTimeSeries([10]),
      [`${IDS.J2}:pressure`]: makeTimeSeries([20]),
    });

    await exportCsvSimulationResults("net", dirHandle, model, reader, {
      selectedAssets: new Set([IDS.J1]),
      properties: ["pressure"],
    });

    const lines = getText("net-export-pressure.csv")
      .split("\n")
      .filter(Boolean);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("J1");
  });

  it("skips assets where getTimeSeries returns null", async () => {
    const IDS = { J1: 1, J2: 2 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { label: "J1" })
      .aJunction(IDS.J2, { label: "J2" })
      .build();
    const { dirHandle, getText } = makeDirectory();
    const reader = makeResultsReader(1, 3600, {
      [`${IDS.J1}:pressure`]: makeTimeSeries([10]),
    });

    await exportCsvSimulationResults("net", dirHandle, model, reader, {
      properties: ["pressure"],
    });

    const lines = getText("net-export-pressure.csv")
      .split("\n")
      .filter(Boolean);
    expect(lines).toHaveLength(2);
  });

  it("calls onProgress for each asset per metric", async () => {
    const IDS = { J1: 1, J2: 2 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .build();
    const { dirHandle } = makeDirectory();
    const reader = makeResultsReader(1, 3600, {});
    const onProgress = vi.fn();

    await exportCsvSimulationResults("net", dirHandle, model, reader, {
      properties: ["pressure", "head"],
      onProgress,
    });

    expect(onProgress).toHaveBeenCalledTimes(4);
    expect(onProgress).toHaveBeenNthCalledWith(1, 25, "pressure");
    expect(onProgress).toHaveBeenNthCalledWith(2, 50, "pressure");
    expect(onProgress).toHaveBeenNthCalledWith(3, 75, "head");
    expect(onProgress).toHaveBeenNthCalledWith(4, 100, "head");
  });

  it("closes the stream after writing each metric", async () => {
    const IDS = { J1: 1 } as const;
    const model = HydraulicModelBuilder.with().aJunction(IDS.J1).build();
    const { dirHandle, getClose } = makeDirectory();
    const reader = makeResultsReader(1, 3600, {});

    await exportCsvSimulationResults("net", dirHandle, model, reader, {
      properties: ["pressure", "head"],
    });

    expect(getClose("net-export-pressure.csv")).toHaveBeenCalledOnce();
    expect(getClose("net-export-head.csv")).toHaveBeenCalledOnce();
  });

  it("triggers download when FileSystem Access API is not supported", async () => {
    const IDS = { J1: 1 } as const;
    const model = HydraulicModelBuilder.with().aJunction(IDS.J1).build();
    const { dirHandle } = makeDirectory();
    const reader = makeResultsReader(1, 3600, {});

    await exportCsvSimulationResults("net", dirHandle, model, reader, {
      properties: ["pressure"],
    });

    expect(FileSystemHelpers.triggerDownload).toHaveBeenCalledWith(
      "net-export-pressure.csv",
      expect.anything(),
    );
  });
});

const makeStream = () => {
  const chunks: Uint8Array[] = [];
  const write = vi.fn((chunk: Uint8Array) => {
    chunks.push(new Uint8Array(chunk));
    return Promise.resolve();
  });
  const close = vi.fn(() => Promise.resolve());
  const abort = vi.fn(() => Promise.resolve());
  const getText = () => {
    const decoder = new TextDecoder();
    return chunks.map((c) => decoder.decode(c)).join("");
  };
  return { write, close, abort, getText };
};

const makeDirectory = () => {
  const streams = new Map<string, ReturnType<typeof makeStream>>();

  const dirHandle = {
    getFileHandle: vi.fn((fileName: string) => {
      const stream = makeStream();
      streams.set(fileName, stream);
      const handle = {
        createWritable: vi.fn(() =>
          Promise.resolve({
            write: stream.write,
            close: stream.close,
            abort: stream.abort,
          } as unknown as FileSystemWritableFileStream),
        ),
      } as unknown as FileSystemFileHandle;
      return Promise.resolve(handle);
    }),
  } as unknown as FileSystemDirectoryHandle;

  const getFileNames = () => Array.from(streams.keys());
  const getText = (fileName: string) => streams.get(fileName)?.getText() ?? "";
  const getClose = (fileName: string) =>
    streams.get(fileName)?.close ?? vi.fn();

  return { dirHandle, getFileNames, getText, getClose };
};

const makeResultsReader = (
  timestepCount: number,
  reportingTimeStep: number,
  data: Record<string, TimeSeries | null>,
): EPSResultsReader =>
  ({
    timestepCount,
    reportingTimeStep,
    iterateTimeSeries: vi.fn(
      async (
        assets: Map<number, { id: number; type: string }>,
        metrics: string[],
        onResult: (
          metric: string,
          asset: { id: number; type: string },
          ts: TimeSeries | null,
        ) => Promise<void>,
      ) => {
        for (const metric of metrics) {
          for (const asset of assets.values()) {
            await onResult(
              metric,
              asset,
              data[`${asset.id}:${metric}`] ?? null,
            );
          }
        }
      },
    ),
  }) as unknown as EPSResultsReader;

const makeTimeSeries = (values: number[]): TimeSeries => ({
  values: new Float32Array(values),
  intervalsCount: values.length,
  intervalSeconds: 3600,
});
