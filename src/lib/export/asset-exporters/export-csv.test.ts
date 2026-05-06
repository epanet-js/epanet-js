import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { ResultsReader } from "src/simulation";
import { ExportedFile } from "../types";
import { exportCsv } from "./export-csv";

const noSelection = new Set<number>();

describe("export-csv", () => {
  it("always returns one file per asset type with correct metadata", () => {
    const model = HydraulicModelBuilder.empty();
    const files = exportCsv(model, false, noSelection);

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
    const files = exportCsv(model, false, noSelection);

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
    const files = exportCsv(model, false, noSelection);

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

    const files = exportCsv(model, true, noSelection, resultsReader);
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
    const files = exportCsv(model, false, noSelection);

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
    expect(row.positionX).toBe("1.1234");
    expect(row.positionY).toBe("2.5678");
    expect(row.junctionConnection).toBe("J1");
    expect(row.pipeConnection).toBe("P1");
    expect(row.connectionX).toBe("1.1234");
    expect(row.connectionY).toBe("2.5678");
  });

  it("exports customer points with empty connection when unconnected", async () => {
    const model = HydraulicModelBuilder.with()
      .aCustomerPoint(10, { label: "CP1", coordinates: [0, 0] })
      .build();
    const files = exportCsv(model, false, noSelection);

    const lines = await readCsv(findFile(files, "customer-points.csv"));
    const [row] = parseCsvRows(lines);

    expect(row.junctionConnection).toBe("");
    expect(row.pipeConnection).toBe("");
  });

  it("only exports selected assets when selectedAssets is non-empty", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { label: "J1" })
      .aJunction(2, { label: "J2" })
      .build();
    const files = exportCsv(model, false, new Set([1]));

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
