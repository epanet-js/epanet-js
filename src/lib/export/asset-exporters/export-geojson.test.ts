import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { ResultsReader } from "src/simulation";
import { ExportedFile } from "../types";
import { exportGeoJson } from "./export-geojson";

const noSelection = new Set<number>();

describe("export-geojson", () => {
  it("generates a GeoJSON file for each asset type", async () => {
    const model = HydraulicModelBuilder.empty();
    const files = exportGeoJson(model, false, noSelection);

    for (const file of files) {
      const geoJson = await parseGeoJson(file);
      expect(geoJson.type).toBe("FeatureCollection");
      expect(Array.isArray(geoJson.features)).toBe(true);
      expect(file.extensions).toEqual([".geojson"]);
      expect(file.mimeTypes).toEqual(["text/geo+json"]);
      expect(file.description).toBe("GeoJSON File");
    }
  });

  it("includes asset geometry and properties in the feature", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { label: "J1", elevation: 10 })
      .build();
    const files = exportGeoJson(model, false, noSelection);

    const geoJson = await parseGeoJson(findFile(files, "junction.geojson"));

    expect(geoJson.features).toHaveLength(1);
    expect(geoJson.features[0].type).toBe("Feature");
    expect(geoJson.features[0].geometry).toMatchObject({ type: "Point" });
    expect(geoJson.features[0].properties).toMatchObject({
      label: "J1",
      elevation: 10,
    });
  });

  it("transforms connections to use labels and not IDs", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(10, { label: "J1" })
      .aJunction(20, { label: "J2" })
      .aPipe(30, { label: "P1", startNodeId: 10, endNodeId: 20 })
      .build();
    const files = exportGeoJson(model, false, noSelection);

    const geoJson = await parseGeoJson(findFile(files, "pipe.geojson"));

    const pipe = geoJson.features.find((f) => f.properties.label === "P1");
    expect(pipe?.type).toBe("Feature");
    expect(pipe?.properties).toMatchObject({
      label: "P1",
      startNode: "J1",
      endNode: "J2",
    });
  });

  it("separates assets by type into their respective files", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { label: "J1" })
      .aJunction(2, { label: "J2" })
      .aPipe(3, { startNodeId: 1, endNodeId: 2 })
      .build();
    const files = exportGeoJson(model, false, noSelection);

    const junctionGeoJson = await parseGeoJson(
      findFile(files, "junction.geojson"),
    );
    const pipeGeoJson = await parseGeoJson(findFile(files, "pipe.geojson"));

    expect(junctionGeoJson.features).toHaveLength(2);
    expect(pipeGeoJson.features).toHaveLength(1);
  });

  it("merges simulation results into feature properties", async () => {
    const pressure = 42;
    const demand = 5;
    const model = HydraulicModelBuilder.with().aJunction(1).build();
    const resultsReader = mockResultsReader(pressure, demand);

    const files = exportGeoJson(model, true, noSelection, resultsReader);

    const geoJson = await parseGeoJson(findFile(files, "junction.geojson"));
    expect(geoJson.features[0].properties).toMatchObject({
      pressure: 42,
      demand: 5,
    });
  });

  it("exports customer points as Point features with label and connection", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { label: "J1" })
      .aPipe(2, { startNodeId: 1, label: "P1" })
      .aCustomerPoint(10, {
        label: "CP1",
        coordinates: [1.5, 2.5],
        connection: { pipeId: 2, junctionId: 1 },
      })
      .build();
    const files = exportGeoJson(model, false, noSelection);

    const geoJson = await parseGeoJson(
      findFile(files, "customerPoint.geojson"),
    );

    expect(geoJson.features).toHaveLength(1);
    expect(geoJson.features[0].type).toBe("Feature");
    expect(geoJson.features[0].geometry).toMatchObject({
      type: "Point",
      coordinates: [1.5, 2.5],
    });
    expect(geoJson.features[0].properties).toMatchObject({
      label: "CP1",
      junctionConnection: "J1",
      pipeConnection: "P1",
    });
  });

  it("exports customer points with empty connection when unconnected", async () => {
    const model = HydraulicModelBuilder.with()
      .aCustomerPoint(10, { label: "CP1", coordinates: [0, 0] })
      .build();
    const files = exportGeoJson(model, false, noSelection);

    const geoJson = await parseGeoJson(
      findFile(files, "customerPoint.geojson"),
    );

    expect(geoJson.features).toHaveLength(1);
    expect(geoJson.features[0].properties).toMatchObject({
      label: "CP1",
    });
  });

  it("only exports selected assets when selectedAssets is non-empty", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { label: "J1" })
      .aJunction(2, { label: "J2" })
      .build();
    const files = exportGeoJson(model, false, new Set([1]));

    const geoJson = await parseGeoJson(findFile(files, "junction.geojson"));

    expect(geoJson.features).toHaveLength(1);
    expect(geoJson.features[0].properties).toMatchObject({ label: "J1" });
  });
});

const findFile = (files: ExportedFile[], name: string) =>
  files.find((f) => f.fileName === name)!;

const parseGeoJson = async (file: ExportedFile) =>
  JSON.parse(await file.blob.text()) as {
    type: string;
    features: {
      type: string;
      geometry: object;
      properties: Record<string, unknown>;
    }[];
  };

const mockResultsReader = (pressure: number, demand: number) =>
  ({
    getJunction: vi.fn().mockReturnValue({ pressure, demand }),
    getTank: vi.fn().mockReturnValue({}),
    getReservoir: vi.fn().mockReturnValue({}),
    getPipe: vi.fn().mockReturnValue({}),
    getPump: vi.fn().mockReturnValue({}),
    getValve: vi.fn().mockReturnValue({}),
  }) as unknown as ResultsReader;
