import * as XLSX from "xlsx";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { ResultsReader } from "src/simulation";
import { exportXlsx } from "./export-xlsx";

function makeMockHandle() {
  const chunks: Uint8Array[] = [];
  const handle = {
    createWritable: () => ({
      write: (chunk: Uint8Array) => {
        chunks.push(chunk);
      },
      close: async () => {},
      abort: async () => {},
    }),
  } as unknown as FileSystemFileHandle;

  const getWorkbook = () => {
    const buffer = Buffer.concat(chunks);
    return XLSX.read(buffer, { type: "buffer" });
  };

  return { handle, getWorkbook };
}

function sheetRows(workbook: XLSX.WorkBook, sheetName: string): string[][] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
}

const noSelection = new Set<number>();

describe("exportXlsx", () => {
  it("produces one sheet per asset type with correct names and row counts", async () => {
    const IDS = {
      J1: 1,
      R1: 2,
      T1: 3,
      P1: 4,
      Pu1: 5,
      V1: 6,
      CP1: 7,
      CP2: 8,
    } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aReservoir(IDS.R1, { coordinates: [1, 1] })
      .aTank(IDS.T1, { coordinates: [2, 2] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.R1 })
      .aPump(IDS.Pu1, { startNodeId: IDS.J1, endNodeId: IDS.R1 })
      .aValve(IDS.V1, { startNodeId: IDS.J1, endNodeId: IDS.R1 })
      .aCustomerPoint(IDS.CP1, { coordinates: [0.5, 0.5] })
      .aCustomerPoint(IDS.CP2, { coordinates: [1.5, 1.5] })
      .build();

    const { handle, getWorkbook } = makeMockHandle();
    await exportXlsx(handle, model, false, noSelection);

    const wb = getWorkbook();
    expect(wb.SheetNames).toEqual([
      "junctions",
      "reservoirs",
      "tanks",
      "pipes",
      "pumps",
      "valves",
      "customer-points",
    ]);

    expect(sheetRows(wb, "junctions")).toHaveLength(2);
    expect(sheetRows(wb, "pipes")).toHaveLength(2);
    expect(sheetRows(wb, "customer-points")).toHaveLength(3);
  });

  it("only writes selected assets, but always writes all customer points", async () => {
    const IDS = { J1: 1, J2: 2, CP1: 3 } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [1, 1] })
      .aCustomerPoint(IDS.CP1, { coordinates: [0.5, 0.5] })
      .build();

    const { handle, getWorkbook } = makeMockHandle();
    await exportXlsx(handle, model, false, new Set([IDS.J1]));

    const wb = getWorkbook();
    expect(sheetRows(wb, "junctions")).toHaveLength(2);
    expect(sheetRows(wb, "customer-points")).toHaveLength(2);
  });

  it("formats pipe connections as node labels in startNode and endNode columns", async () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0], label: "A" })
      .aJunction(IDS.J2, { coordinates: [1, 0], label: "B" })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    const { handle, getWorkbook } = makeMockHandle();
    await exportXlsx(handle, model, false, noSelection);

    const wb = getWorkbook();
    const rows = sheetRows(wb, "pipes");
    const headers = rows[0];
    const dataRow = rows[1];

    const startIdx = headers.indexOf("startNode");
    const endIdx = headers.indexOf("endNode");

    expect(dataRow[startIdx]).toBe("A");
    expect(dataRow[endIdx]).toBe("B");
  });

  it("appends sim_ columns when includeSimulationResults is true", async () => {
    const IDS = { J1: 1 } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .build();

    const mockResultsReader = {
      getJunction: vi.fn().mockReturnValue({ pressure: 42, demand: 5 }),
      getTank: vi.fn().mockReturnValue({}),
      getReservoir: vi.fn().mockReturnValue({}),
      getPipe: vi.fn().mockReturnValue({}),
      getPump: vi.fn().mockReturnValue({}),
      getValve: vi.fn().mockReturnValue({}),
    } as unknown as ResultsReader;

    const { handle, getWorkbook } = makeMockHandle();
    await exportXlsx(handle, model, true, noSelection, mockResultsReader);

    const wb = getWorkbook();
    const rows = sheetRows(wb, "junctions");
    const headers = rows[0];
    const dataRow = rows[1];

    const pressureIdx = headers.indexOf("sim_pressure");
    const demandIdx = headers.indexOf("sim_demand");

    expect(pressureIdx).toBeGreaterThanOrEqual(0);
    expect(demandIdx).toBeGreaterThanOrEqual(0);
    expect(String(dataRow[pressureIdx])).toBe("42");
    expect(String(dataRow[demandIdx])).toBe("5");
  });

  it("writes customer point sheet with correct headers and connection values", async () => {
    const IDS = { J1: 1, P1: 2, CP1: 3, CP2: 4 } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0], label: "JA" })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, label: "PA" })
      .aCustomerPoint(IDS.CP1, {
        coordinates: [0.5, 0.5],
        connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
      })
      .aCustomerPoint(IDS.CP2, { coordinates: [2, 2] })
      .build();

    const { handle, getWorkbook } = makeMockHandle();
    await exportXlsx(handle, model, false, noSelection);

    const wb = getWorkbook();
    const rows = sheetRows(wb, "customer-points");
    const headers = rows[0];

    expect(headers).toEqual([
      "label",
      "positionX",
      "positionY",
      "junctionConnection",
      "pipeConnection",
      "connectionX",
      "connectionY",
    ]);

    expect(rows).toHaveLength(3);

    const junctionIdx = headers.indexOf("junctionConnection");
    const pipeIdx = headers.indexOf("pipeConnection");

    const cp1Row = rows[1];
    const cp2Row = rows[2];

    expect(cp1Row[junctionIdx]).toBe("JA");
    expect(cp1Row[pipeIdx]).toBe("PA");
    expect(cp2Row[junctionIdx] ?? "").toBe("");
    expect(cp2Row[pipeIdx] ?? "").toBe("");
  });
});
