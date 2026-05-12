import * as XLSX from "xlsx";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { EPSResultsReader } from "src/simulation";
import { TimeSeries } from "src/simulation/epanet/eps-results-reader";
import { FileSystemHelpers } from "../file-system-helpers";
import { exportXlsxSimulationResults } from "./export-xlsx-time-series";
import { NUM_DECIMAL_PLACES } from "../constants";

const noSelection = new Set<number>();

describe("exportXlsxSimulationResults", () => {
  beforeEach(() => {
    vi.spyOn(FileSystemHelpers, "isFileSystemAccessSupported").mockReturnValue(
      false,
    );
    vi.spyOn(FileSystemHelpers, "triggerDownload").mockResolvedValue(undefined);
  });

  it("creates a single XLSX file named with the network name", async () => {
    const IDS = { J1: 1 } as const;
    const model = HydraulicModelBuilder.with().aJunction(IDS.J1).build();
    const { dirHandle, getFileNames } = makeDirectory();
    const reader = makeResultsReader(1, 3600, {});

    await exportXlsxSimulationResults(
      "my-network",
      dirHandle,
      model,
      reader,
      noSelection,
      ["pressure"],
      vi.fn(),
    );

    expect(getFileNames()).toEqual(["my-network-export.xlsx"]);
  });

  it("creates one sheet per metric with display names", async () => {
    const IDS = { J1: 1 } as const;
    const model = HydraulicModelBuilder.with().aJunction(IDS.J1).build();
    const { dirHandle, getWorkbook } = makeDirectory();
    const reader = makeResultsReader(1, 3600, {});

    await exportXlsxSimulationResults(
      "net",
      dirHandle,
      model,
      reader,
      noSelection,
      ["pressure", "flow", "status"],
      vi.fn(),
    );

    const wb = getWorkbook("net-export.xlsx");
    expect(wb.SheetNames).toEqual(["Pressure", "Flow", "Status"]);
  });

  it("writes header row with id, type, and HH:MM timestep columns", async () => {
    const IDS = { J1: 1 } as const;
    const model = HydraulicModelBuilder.with().aJunction(IDS.J1).build();
    const { dirHandle, getWorkbook } = makeDirectory();
    const reader = makeResultsReader(3, 5400, {});

    await exportXlsxSimulationResults(
      "net",
      dirHandle,
      model,
      reader,
      noSelection,
      ["pressure"],
      vi.fn(),
    );

    const wb = getWorkbook("net-export.xlsx");
    const rows = sheetRows(wb, "Pressure");
    expect(rows[0]).toEqual(["id", "type", "00:00", "01:30", "03:00"]);
  });

  it("writes node metrics only for nodes and link metrics only for links", async () => {
    const IDS = { J1: 1, P1: 2 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { label: "J1" })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, label: "P1" })
      .build();
    const { dirHandle, getWorkbook } = makeDirectory();
    const reader = makeResultsReader(1, 3600, {
      [`${IDS.J1}:pressure`]: makeTimeSeries([10]),
      [`${IDS.P1}:pressure`]: makeTimeSeries([99]),
      [`${IDS.J1}:flow`]: makeTimeSeries([99]),
      [`${IDS.P1}:flow`]: makeTimeSeries([5]),
    });

    await exportXlsxSimulationResults(
      "net",
      dirHandle,
      model,
      reader,
      noSelection,
      ["pressure", "flow"],
      vi.fn(),
    );

    const wb = getWorkbook("net-export.xlsx");

    const pressureRows = sheetRows(wb, "Pressure");
    expect(pressureRows).toHaveLength(2);
    expect(pressureRows[1][0]).toBe("J1");

    const flowRows = sheetRows(wb, "Flow");
    expect(flowRows).toHaveLength(2);
    expect(flowRows[1][0]).toBe("P1");
  });

  it("maps status to closed when value is less than 3 and open when 3 or more", async () => {
    const IDS = { J1: 1, P1: 2, P2: 3 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, label: "P1" })
      .aPipe(IDS.P2, { startNodeId: IDS.J1, label: "P2" })
      .build();
    const { dirHandle, getWorkbook } = makeDirectory();
    const reader = makeResultsReader(1, 3600, {
      [`${IDS.P1}:status`]: makeTimeSeries([2]),
      [`${IDS.P2}:status`]: makeTimeSeries([3]),
    });

    await exportXlsxSimulationResults(
      "net",
      dirHandle,
      model,
      reader,
      noSelection,
      ["status"],
      vi.fn(),
    );

    const wb = getWorkbook("net-export.xlsx");
    const rows = sheetRows(wb, "Status");
    expect(rows[1][2]).toBe("closed");
    expect(rows[2][2]).toBe("open");
  });

  it(`formats numeric values with ${NUM_DECIMAL_PLACES} decimal places`, async () => {
    const IDS = { J1: 1 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { label: "J1" })
      .build();
    const { dirHandle, getWorkbook } = makeDirectory();
    const reader = makeResultsReader(1, 3600, {
      [`${IDS.J1}:pressure`]: makeTimeSeries([1.23456]),
    });

    await exportXlsxSimulationResults(
      "net",
      dirHandle,
      model,
      reader,
      noSelection,
      ["pressure"],
      vi.fn(),
    );

    const wb = getWorkbook("net-export.xlsx");
    const rows = sheetRows(wb, "Pressure");
    expect(String(rows[1][2])).toBe(
      (1.2345600128173828).toFixed(NUM_DECIMAL_PLACES),
    );
  });

  it("skips assets not in selection when selection is non-empty", async () => {
    const IDS = { J1: 1, J2: 2 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { label: "J1" })
      .aJunction(IDS.J2, { label: "J2" })
      .build();
    const { dirHandle, getWorkbook } = makeDirectory();
    const reader = makeResultsReader(1, 3600, {
      [`${IDS.J1}:pressure`]: makeTimeSeries([10]),
      [`${IDS.J2}:pressure`]: makeTimeSeries([20]),
    });

    await exportXlsxSimulationResults(
      "net",
      dirHandle,
      model,
      reader,
      new Set([IDS.J1]),
      ["pressure"],
      vi.fn(),
    );

    const wb = getWorkbook("net-export.xlsx");
    const rows = sheetRows(wb, "Pressure");
    expect(rows).toHaveLength(2);
    expect(rows[1][0]).toBe("J1");
  });

  it("skips assets where time series is null", async () => {
    const IDS = { J1: 1, J2: 2 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { label: "J1" })
      .aJunction(IDS.J2, { label: "J2" })
      .build();
    const { dirHandle, getWorkbook } = makeDirectory();
    const reader = makeResultsReader(1, 3600, {
      [`${IDS.J1}:pressure`]: makeTimeSeries([10]),
    });

    await exportXlsxSimulationResults(
      "net",
      dirHandle,
      model,
      reader,
      noSelection,
      ["pressure"],
      vi.fn(),
    );

    const wb = getWorkbook("net-export.xlsx");
    const rows = sheetRows(wb, "Pressure");
    expect(rows).toHaveLength(2);
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

    await exportXlsxSimulationResults(
      "net",
      dirHandle,
      model,
      reader,
      noSelection,
      ["pressure", "head"],
      onProgress,
    );

    expect(onProgress).toHaveBeenCalledTimes(4);
  });

  it("closes the stream after writing", async () => {
    const IDS = { J1: 1 } as const;
    const model = HydraulicModelBuilder.with().aJunction(IDS.J1).build();
    const { dirHandle, getClose } = makeDirectory();
    const reader = makeResultsReader(1, 3600, {});

    await exportXlsxSimulationResults(
      "net",
      dirHandle,
      model,
      reader,
      noSelection,
      ["pressure"],
      vi.fn(),
    );

    expect(getClose("net-export.xlsx")).toHaveBeenCalledOnce();
  });

  it("triggers download when FileSystem Access API is not supported", async () => {
    const IDS = { J1: 1 } as const;
    const model = HydraulicModelBuilder.with().aJunction(IDS.J1).build();
    const { dirHandle } = makeDirectory();
    const reader = makeResultsReader(1, 3600, {});

    await exportXlsxSimulationResults(
      "net",
      dirHandle,
      model,
      reader,
      noSelection,
      ["pressure"],
      vi.fn(),
    );

    expect(FileSystemHelpers.triggerDownload).toHaveBeenCalledWith(
      "net-export.xlsx",
      expect.anything(),
    );
  });
});

function sheetRows(workbook: XLSX.WorkBook, sheetName: string): unknown[][] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
}

const makeStream = () => {
  const chunks: Uint8Array[] = [];
  const write = vi.fn((chunk: Uint8Array) => {
    chunks.push(new Uint8Array(chunk));
    return Promise.resolve();
  });
  const close = vi.fn(() => Promise.resolve());
  const abort = vi.fn(() => Promise.resolve());

  const getBuffer = () => Buffer.concat(chunks);

  return { write, close, abort, getBuffer };
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
  const getWorkbook = (fileName: string) => {
    const buffer = streams.get(fileName)!.getBuffer();
    return XLSX.read(buffer, { type: "buffer" });
  };
  const getClose = (fileName: string) =>
    streams.get(fileName)?.close ?? vi.fn();

  return { dirHandle, getFileNames, getWorkbook, getClose };
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
        assets: Map<
          number,
          { id: number; type: string; isLink: boolean; label: string }
        >,
        metrics: string[],
        onResult: (
          metric: string,
          asset: { id: number; type: string; isLink: boolean; label: string },
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
