import * as XLSX from "xlsx";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { ResultsReader } from "src/simulation";
import { exportXlsx } from "./export-xlsx";
import { WGS84 } from "src/lib/projections";
import { NUM_DECIMAL_PLACES, COORDINATE_DECIMAL_PLACES } from "../constants";

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

const translate = (key: string) => key;

describe("exportXlsx", () => {
  it("produces one sheet per non-empty asset type with correct names and row counts", async () => {
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
    await exportXlsx(handle, model, WGS84, translate);

    const wb = getWorkbook();
    expect(wb.SheetNames).toEqual([
      "junctions",
      "reservoirs",
      "tanks",
      "pipes",
      "pumps",
      "valves",
      "customerPoints",
    ]);

    expect(sheetRows(wb, "junctions")).toHaveLength(2);
    expect(sheetRows(wb, "pipes")).toHaveLength(2);
    expect(sheetRows(wb, "customerPoints")).toHaveLength(3);
  });

  it("omits sheets for asset types with no records", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { coordinates: [0, 0] })
      .build();

    const { handle, getWorkbook } = makeMockHandle();
    await exportXlsx(handle, model, WGS84, translate);

    const wb = getWorkbook();
    expect(wb.SheetNames).toEqual(["junctions"]);
  });

  it("filters both assets and customer points by selectedAssets", async () => {
    const IDS = { J1: 1, J2: 2, CP1: 3, CP2: 4 } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [1, 1] })
      .aCustomerPoint(IDS.CP1, { coordinates: [0.5, 0.5] })
      .aCustomerPoint(IDS.CP2, { coordinates: [0.7, 0.7] })
      .build();

    const { handle, getWorkbook } = makeMockHandle();
    await exportXlsx(handle, model, WGS84, translate, {
      assetIdsFilter: new Set([IDS.J1]),
      customerPointIdFilter: new Set([IDS.CP1]),
    });

    const wb = getWorkbook();
    // Only J1 exported (J2 filtered).
    expect(sheetRows(wb, "junctions")).toHaveLength(2);
    // Only CP1 exported (CP2 filtered).
    expect(sheetRows(wb, "customerPoints")).toHaveLength(2);
  });

  it("omits the customer-points sheet when CPs are filtered to an empty set", async () => {
    const IDS = { J1: 1, CP1: 2 } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aCustomerPoint(IDS.CP1, { coordinates: [0.5, 0.5] })
      .build();

    const { handle, getWorkbook } = makeMockHandle();
    await exportXlsx(handle, model, WGS84, translate, {
      assetIdsFilter: new Set([IDS.J1]),
      customerPointIdFilter: new Set(),
    });

    const wb = getWorkbook();
    expect(wb.SheetNames).not.toContain("customerPoints");
  });

  it("exports all CPs when selectedCustomerPoints is null (independent of asset filter)", async () => {
    const IDS = { J1: 1, J2: 2, CP1: 3 } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [1, 1] })
      .aCustomerPoint(IDS.CP1, { coordinates: [0.5, 0.5] })
      .build();

    const { handle, getWorkbook } = makeMockHandle();
    await exportXlsx(handle, model, WGS84, translate, {
      assetIdsFilter: new Set([IDS.J1]),
      customerPointIdFilter: null,
    });

    const wb = getWorkbook();
    // J2 filtered out by selectedAssets…
    expect(sheetRows(wb, "junctions")).toHaveLength(2);
    // …but CPs unfiltered because selectedCustomerPoints is null.
    expect(sheetRows(wb, "customerPoints")).toHaveLength(2);
  });

  it("formats pipe connections as node labels in startNode and endNode columns", async () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0], label: "A" })
      .aJunction(IDS.J2, { coordinates: [1, 0], label: "B" })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    const { handle, getWorkbook } = makeMockHandle();
    await exportXlsx(handle, model, WGS84, translate);

    const wb = getWorkbook();
    const rows = sheetRows(wb, "pipes");
    const headers = rows[0];
    const dataRow = rows[1];

    const startIdx = headers.indexOf("startNode");
    const endIdx = headers.indexOf("endNode");

    expect(dataRow[startIdx]).toBe("A");
    expect(dataRow[endIdx]).toBe("B");
  });

  it("appends marked simulation columns when includeSimulationResults is true", async () => {
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
    await exportXlsx(handle, model, WGS84, translate, {
      includeSimulationResults: true,
      resultsReader: mockResultsReader,
    });

    const wb = getWorkbook();
    const rows = sheetRows(wb, "junctions");
    const headers = rows[0];
    const dataRow = rows[1];

    const pressureIdx = headers.indexOf("pressure (simulation)");
    const demandIdx = headers.indexOf("demand (simulation)");

    expect(pressureIdx).toBeGreaterThanOrEqual(0);
    expect(demandIdx).toBeGreaterThanOrEqual(0);
    expect(String(dataRow[pressureIdx])).toBe("42");
    expect(String(dataRow[demandIdx])).toBe("5");
  });

  it(`formats coordinates with ${COORDINATE_DECIMAL_PLACES} decimal places and other numbers with ${NUM_DECIMAL_PLACES}`, async () => {
    const IDS = { J1: 1 } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0.123456789, 1.987654321] })
      .build();

    const mockResultsReader = {
      getJunction: vi
        .fn()
        .mockReturnValue({ pressure: 42.123456789, demand: 5.00019 }),
      getTank: vi.fn().mockReturnValue({}),
      getReservoir: vi.fn().mockReturnValue({}),
      getPipe: vi.fn().mockReturnValue({}),
      getPump: vi.fn().mockReturnValue({}),
      getValve: vi.fn().mockReturnValue({}),
    } as unknown as ResultsReader;

    const { handle, getWorkbook } = makeMockHandle();
    await exportXlsx(handle, model, WGS84, translate, {
      includeSimulationResults: true,
      resultsReader: mockResultsReader,
    });

    const wb = getWorkbook();
    const rows = sheetRows(wb, "junctions");
    const headers = rows[0];
    const dataRow = rows[1];

    const posXIdx = headers.indexOf("positionX");
    const posYIdx = headers.indexOf("positionY");
    const pressureIdx = headers.indexOf("pressure (simulation)");
    const demandIdx = headers.indexOf("demand (simulation)");

    expect(String(dataRow[posXIdx])).toBe(
      (0.123456789).toFixed(COORDINATE_DECIMAL_PLACES),
    );
    expect(String(dataRow[posYIdx])).toBe(
      (1.987654321).toFixed(COORDINATE_DECIMAL_PLACES),
    );
    expect(String(dataRow[pressureIdx])).toBe(
      (42.123456789).toFixed(NUM_DECIMAL_PLACES),
    );
    expect(String(dataRow[demandIdx])).toBe(
      (5.00019).toFixed(NUM_DECIMAL_PLACES),
    );
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
    await exportXlsx(handle, model, WGS84, translate);

    const wb = getWorkbook();
    const rows = sheetRows(wb, "customerPoints");
    const headers = rows[0];

    expect(headers).toEqual([
      "label",
      "positionX",
      "positionY",
      "junction",
      "pipe",
      "connectionX",
      "connectionY",
    ]);

    expect(rows).toHaveLength(3);

    const junctionIdx = headers.indexOf("junction");
    const pipeIdx = headers.indexOf("pipe");

    const cp1Row = rows[1];
    const cp2Row = rows[2];

    expect(cp1Row[junctionIdx]).toBe("JA");
    expect(cp1Row[pipeIdx]).toBe("PA");
    expect(cp2Row[junctionIdx] ?? "").toBe("");
    expect(cp2Row[pipeIdx] ?? "").toBe("");
  });

  it("omits the length column for valves and pumps but keeps it for pipes", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1)
      .aJunction(2)
      .aPipe(3, { startNodeId: 1, endNodeId: 2 })
      .aValve(4, { startNodeId: 1, endNodeId: 2 })
      .aPump(5, { startNodeId: 1, endNodeId: 2 })
      .build();

    const { handle, getWorkbook } = makeMockHandle();
    await exportXlsx(handle, model, WGS84, translate);
    const wb = getWorkbook();

    expect(sheetRows(wb, "pipes")[0]).toContain("length");
    expect(sheetRows(wb, "valves")[0]).not.toContain("length");
    expect(sheetRows(wb, "pumps")[0]).not.toContain("length");
  });

  it("exports EPANET defaults for unmapped optional fields, blank for required nulls", async () => {
    const model = HydraulicModelBuilder.with()
      .aPipe(1, { label: "P1", diameter: null })
      .build();
    const pipe = model.assets.get(1)!;
    pipe.setProperty("minorLoss", undefined);

    const { handle, getWorkbook } = makeMockHandle();
    await exportXlsx(handle, model, WGS84, translate);

    const rows = sheetRows(getWorkbook(), "pipes");
    const headers = rows[0];
    const dataRow = rows[1];

    const minorLossIdx = headers.indexOf("minorLoss");
    const diameterIdx = headers.indexOf("diameter");

    expect(String(dataRow[minorLossIdx])).toBe("0");
    expect(dataRow[diameterIdx] ?? "").toBe("");
  });

  it("transforms coordinates using the given projection", async () => {
    const xyGrid = {
      type: "xy-grid" as const,
      id: "test",
      name: "Test XY Grid",
      centroid: [0, 0] as [number, number],
      scale: 1000,
    };
    const IDS = { J1: 1, CP1: 2, P1: 3 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [1, 0] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1 })
      .aCustomerPoint(IDS.CP1, {
        coordinates: [1, 0],
        connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
      })
      .build();

    const { handle, getWorkbook } = makeMockHandle();
    await exportXlsx(handle, model, xyGrid, translate);

    const wb = getWorkbook();
    const jRows = sheetRows(wb, "junctions");
    const jHeaders = jRows[0];
    const jData = jRows[1];
    const posXIdx = jHeaders.indexOf("positionX");
    expect(String(jData[posXIdx])).not.toBe("1");

    const cpRows = sheetRows(wb, "customerPoints");
    const cpHeaders = cpRows[0];
    const cpData = cpRows[1];
    const cpXIdx = cpHeaders.indexOf("positionX");
    expect(String(cpData[cpXIdx])).not.toBe("1");
  });

  it("localizes headers", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { label: "J1", elevation: 42 })
      .aCustomerPoint(2, { coordinates: [0, 0] })
      .build();
    const translations: Record<string, string> = {
      elevation: "Elevación",
      label: "Etiqueta",
    };
    const translateStub = (key: string) => translations[key] ?? key;

    const { handle, getWorkbook } = makeMockHandle();
    await exportXlsx(handle, model, WGS84, translateStub);

    const wb = getWorkbook();
    const jHeaders = sheetRows(wb, "junctions")[0];
    expect(jHeaders).toContain("Elevación");
    expect(jHeaders).toContain("Etiqueta");
    expect(jHeaders).not.toContain("elevation");

    const cpHeaders = sheetRows(wb, "customerPoints")[0];
    expect(cpHeaders).toContain("Etiqueta");
    expect(cpHeaders).not.toContain("junctionConnection");
  });

  it("uses custom attribute labels as headers", async () => {
    const model = HydraulicModelBuilder.with()
      .aCustomAttribute("junction", {
        id: "custom-1",
        label: "Zone",
        type: "text",
      })
      .aJunction(1, { label: "J1" })
      .build();
    model.assets.get(1)!.setProperty("custom-1", "north");

    const { handle, getWorkbook } = makeMockHandle();
    await exportXlsx(handle, model, WGS84, translate);

    const wb = getWorkbook();
    const rows = sheetRows(wb, "junctions");
    const headers = rows[0];
    const zoneIdx = headers.indexOf("Zone");

    expect(zoneIdx).toBeGreaterThanOrEqual(0);
    expect(headers).not.toContain("custom-1");
    expect(rows[1][zoneIdx]).toBe("north");
  });

  it("localizes worksheet names", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { coordinates: [0, 0] })
      .aPipe(2, { startNodeId: 1 })
      .aCustomerPoint(3, { coordinates: [0.5, 0.5] })
      .build();
    const translations: Record<string, string> = {
      junctions: "Nudos",
      pipes: "Tuberías",
      customerPoints: "Acometidas",
    };
    const translateStub = (key: string) => translations[key] ?? key;

    const { handle, getWorkbook } = makeMockHandle();
    await exportXlsx(handle, model, WGS84, translateStub);

    const wb = getWorkbook();
    expect(wb.SheetNames).toEqual(["Nudos", "Tuberías", "Acometidas"]);
  });

  it("sanitizes and de-duplicates localized worksheet names", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { coordinates: [0, 0] })
      .aPipe(2, { startNodeId: 1 })
      .build();
    const translations: Record<string, string> = {
      junctions: "Assets: network",
      pipes: "Assets/ network",
    };
    const translateStub = (key: string) => translations[key] ?? key;

    const { handle, getWorkbook } = makeMockHandle();
    await exportXlsx(handle, model, WGS84, translateStub);

    const wb = getWorkbook();
    expect(wb.SheetNames).toEqual(["Assets  network", "Assets  network 2"]);
  });
});
