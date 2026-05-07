import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { ResultsReader } from "src/simulation";
import { ExportedFile } from "../types";
import { exportGeoJson } from "./export-geojson";
import { WGS84 } from "src/lib/projections";

const noSelection = new Set<number>();

describe("export-geojson", () => {
  it("generates a GeoJSON file for each asset type", async () => {
    const model = HydraulicModelBuilder.empty();
    const files = exportGeoJson(model, false, noSelection, WGS84);

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
    const files = exportGeoJson(model, false, noSelection, WGS84);

    const geoJson = await parseGeoJson(findFile(files, "junctions.geojson"));

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
    const files = exportGeoJson(model, false, noSelection, WGS84);

    const geoJson = await parseGeoJson(findFile(files, "pipes.geojson"));

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
    const files = exportGeoJson(model, false, noSelection, WGS84);

    const junctionGeoJson = await parseGeoJson(
      findFile(files, "junctions.geojson"),
    );
    const pipeGeoJson = await parseGeoJson(findFile(files, "pipes.geojson"));

    expect(junctionGeoJson.features).toHaveLength(2);
    expect(pipeGeoJson.features).toHaveLength(1);
  });

  it("merges simulation results into feature properties", async () => {
    const pressure = 42;
    const demand = 5;
    const model = HydraulicModelBuilder.with().aJunction(1).build();
    const resultsReader = mockResultsReader(pressure, demand);

    const files = exportGeoJson(model, true, noSelection, WGS84, resultsReader);

    const geoJson = await parseGeoJson(findFile(files, "junctions.geojson"));
    expect(geoJson.features[0].properties).toMatchObject({
      sim_pressure: 42,
      sim_demand: 5,
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
    const files = exportGeoJson(model, false, noSelection, WGS84);

    const geoJson = await parseGeoJson(
      findFile(files, "customer-points.geojson"),
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
    const files = exportGeoJson(model, false, noSelection, WGS84);

    const geoJson = await parseGeoJson(
      findFile(files, "customer-points.geojson"),
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
    const files = exportGeoJson(model, false, new Set([1]), WGS84);

    const geoJson = await parseGeoJson(findFile(files, "junctions.geojson"));

    expect(geoJson.features).toHaveLength(1);
    expect(geoJson.features[0].properties).toMatchObject({ label: "J1" });
  });

  it("transforms geometry coordinates using the given projection", async () => {
    const xyGrid = {
      type: "xy-grid" as const,
      id: "test",
      name: "Test XY Grid",
      centroid: [0, 0] as [number, number],
      scale: 1000,
    };
    const IDS = { J1: 1, P1: 2, CP1: 3 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [1, 0] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1 })
      .aCustomerPoint(IDS.CP1, {
        coordinates: [1, 0],
        connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
      })
      .build();

    const files = exportGeoJson(model, false, noSelection, xyGrid);

    const jGeoJson = await parseGeoJson(findFile(files, "junctions.geojson"));
    const [jx] = jGeoJson.features[0].geometry.coordinates as number[];
    expect(jx).not.toBe(1);

    const cpGeoJson = await parseGeoJson(
      findFile(files, "customer-points.geojson"),
    );
    const [cx] = cpGeoJson.features[0].geometry.coordinates as number[];
    expect(cx).not.toBe(1);
  });
});

const findFile = (files: ExportedFile[], name: string) =>
  files.find((f) => f.fileName === name)!;

const parseGeoJson = async (file: ExportedFile) =>
  JSON.parse(await file.blob.text()) as {
    type: string;
    features: {
      type: string;
      geometry: { type: string; coordinates: unknown };
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
