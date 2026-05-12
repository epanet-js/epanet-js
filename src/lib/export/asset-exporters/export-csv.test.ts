import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { ResultsReader } from "src/simulation";
import { ExportedFile } from "../types";
import { exportCsv } from "./export-csv";
import { WGS84 } from "src/lib/projections";
import { COORDINATE_DECIMAL_PLACES } from "../constants";

const noSelection = new Set<number>();

describe("export-csv", () => {
  it("always returns one file per asset type with correct metadata", () => {
    const model = HydraulicModelBuilder.empty();
    const files = exportCsv(model, false, noSelection, WGS84);

    expect(files).toHaveLength(7);
    expect(files.map((f) => f.fileName)).toEqual(
      expect.arrayContaining(ALL_ASSET_FILE_NAMES.map((t) => `${t}.csv`)),
    );
    expect(files[0].extensions).toEqual([".csv"]);
    expect(files[0].mimeTypes).toEqual(["text/csv"]);
    expect(files[0].description).toBe("CSV File");
  });

  it("uses asset properties as headers and values as data rows", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { label: "J1", elevation: 42 })
      .build();
    const files = exportCsv(model, false, noSelection, WGS84);

    const lines = await readCsv(findFile(files, "junctions.csv"));
    const headers = lines[0].split(",").filter(Boolean);
    const [row] = parseCsvRows(lines);

    expect(headers).toContain("label");
    expect(headers).toContain("elevation");
    expect(headers).toContain("type");
    expect(headers.some((h) => h.startsWith("sim_"))).toBe(false);
    expect(row.label).toBe("J1");
    expect(row.type).toBe("junction");
    expect(row.elevation).toBe("42");
  });

  it("generates separate CSV files per asset type", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { label: "J1" })
      .aPipe(2, { startNodeId: 1 })
      .build();
    const files = exportCsv(model, false, noSelection, WGS84);

    const junctionLines = await readCsv(findFile(files, "junctions.csv"));
    const pipeLines = await readCsv(findFile(files, "pipes.csv"));

    expect(junctionLines).toHaveLength(2);
    expect(pipeLines).toHaveLength(2);
  });

  it("adds sim_ columns from resultsReader when includeSimulationResults is true", async () => {
    const model = HydraulicModelBuilder.with().aJunction(1).build();
    const pressure = 42;
    const demand = 10;
    const resultsReader = mockResultsReader(pressure, demand);

    const files = exportCsv(model, true, noSelection, WGS84, resultsReader);
    const lines = await readCsv(findFile(files, "junctions.csv"));
    const [row] = parseCsvRows(lines);

    expect(row.sim_pressure).toBe("42");
    expect(row.sim_demand).toBe("10");
  });

  it("exports customer points with all connection columns", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { label: "J1" })
      .aPipe(2, { startNodeId: 1, label: "P1" })
      .aCustomerPoint(10, {
        label: "CP1",
        coordinates: [1.1234, 2.5678],
        connection: { pipeId: 2, junctionId: 1 },
      })
      .build();
    const files = exportCsv(model, false, noSelection, WGS84);

    const lines = await readCsv(findFile(files, "customer-points.csv"));
    const headers = lines[0].split(",").filter(Boolean);
    const [row] = parseCsvRows(lines);

    expect(headers).toEqual([
      "label",
      "positionX",
      "positionY",
      "junctionConnection",
      "pipeConnection",
      "connectionX",
      "connectionY",
    ]);
    expect(row.label).toBe("CP1");
    expect(row.positionX).toBe((1.1234).toFixed(COORDINATE_DECIMAL_PLACES));
    expect(row.positionY).toBe((2.5678).toFixed(COORDINATE_DECIMAL_PLACES));
    expect(row.junctionConnection).toBe("J1");
    expect(row.pipeConnection).toBe("P1");
    expect(row.connectionX).toBe((1.1234).toFixed(COORDINATE_DECIMAL_PLACES));
    expect(row.connectionY).toBe((2.5678).toFixed(COORDINATE_DECIMAL_PLACES));
  });

  it(`formats coordinate columns with ${COORDINATE_DECIMAL_PLACES} decimal places`, async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { coordinates: [1.123456789, 2.987654321] })
      .aPipe(2, { startNodeId: 1, label: "P1" })
      .aCustomerPoint(10, {
        label: "CP1",
        coordinates: [3.111111111, 4.999999999],
        connection: { pipeId: 2, junctionId: 1 },
      })
      .build();
    const files = exportCsv(model, false, noSelection, WGS84);

    const junctionLines = await readCsv(findFile(files, "junctions.csv"));
    const [jRow] = parseCsvRows(junctionLines);
    expect(jRow.positionX).toBe(
      (1.123456789).toFixed(COORDINATE_DECIMAL_PLACES),
    );
    expect(jRow.positionY).toBe(
      (2.987654321).toFixed(COORDINATE_DECIMAL_PLACES),
    );

    const cpLines = await readCsv(findFile(files, "customer-points.csv"));
    const [cpRow] = parseCsvRows(cpLines);
    expect(cpRow.positionX).toBe(
      (3.111111111).toFixed(COORDINATE_DECIMAL_PLACES),
    );
    expect(cpRow.positionY).toBe(
      (4.999999999).toFixed(COORDINATE_DECIMAL_PLACES),
    );
    expect(cpRow.connectionX).toBe(
      (3.111111111).toFixed(COORDINATE_DECIMAL_PLACES),
    );
    expect(cpRow.connectionY).toBe(
      (4.999999999).toFixed(COORDINATE_DECIMAL_PLACES),
    );
  });

  it("exports customer points with empty connection when unconnected", async () => {
    const model = HydraulicModelBuilder.with()
      .aCustomerPoint(10, { label: "CP1", coordinates: [0, 0] })
      .build();
    const files = exportCsv(model, false, noSelection, WGS84);

    const lines = await readCsv(findFile(files, "customer-points.csv"));
    const [row] = parseCsvRows(lines);

    expect(row.junctionConnection).toBe("");
    expect(row.pipeConnection).toBe("");
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

    const files = exportCsv(model, false, noSelection, xyGrid);

    const junctionLines = await readCsv(findFile(files, "junctions.csv"));
    const [jRow] = parseCsvRows(junctionLines);
    expect(jRow.positionX).not.toBe("1.0000");

    const cpLines = await readCsv(findFile(files, "customer-points.csv"));
    const [cpRow] = parseCsvRows(cpLines);
    expect(cpRow.positionX).not.toBe("1.0000");
    expect(cpRow.connectionX).not.toBe("1.0000");
  });

  it("only exports selected assets when selectedAssets is non-empty", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { label: "J1" })
      .aJunction(2, { label: "J2" })
      .build();
    const files = exportCsv(model, false, new Set([1]), WGS84);

    const lines = await readCsv(findFile(files, "junctions.csv"));
    const rows = parseCsvRows(lines);

    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe("J1");
  });
});

const ALL_ASSET_FILE_NAMES = [
  "junctions",
  "reservoirs",
  "tanks",
  "pipes",
  "pumps",
  "valves",
  "customer-points",
];

const mockResultsReader = (pressure: number, demand: number) => {
  return {
    getJunction: vi.fn().mockReturnValue({ pressure, demand }),
    getTank: vi.fn().mockReturnValue({}),
    getReservoir: vi.fn().mockReturnValue({}),
    getPipe: vi.fn().mockReturnValue({}),
    getPump: vi.fn().mockReturnValue({}),
    getValve: vi.fn().mockReturnValue({}),
  } as unknown as ResultsReader;
};

const findFile = (files: ExportedFile[], name: string) =>
  files.find((f) => f.fileName === name)!;

const readCsv = async (file: ExportedFile) => {
  const text = await file.blob.text();
  return text.split("\n").filter(Boolean);
};

const parseCsvRows = (lines: string[]) => {
  const headers = lines[0].split(",").filter(Boolean);
  return lines.slice(1).map((line) => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
};
