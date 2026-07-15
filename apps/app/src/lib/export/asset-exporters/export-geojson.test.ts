import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { ResultsReader } from "src/simulation";
import { ExportedFile } from "../types";
import { exportGeoJson } from "./export-geojson";
import { WGS84 } from "src/lib/projections";
import { COORDINATE_DECIMAL_PLACES, NUM_DECIMAL_PLACES } from "../constants";

const translate = (key: string) => key;

describe("export-geojson", () => {
  it("returns no files for an empty model", () => {
    const model = HydraulicModelBuilder.empty();
    const files = exportGeoJson(model, WGS84, translate);

    expect(files).toHaveLength(0);
  });

  it("returns one GeoJSON file per non-empty asset type with correct metadata", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { coordinates: [0, 0] })
      .build();
    const files = exportGeoJson(model, WGS84, translate);

    expect(files).toHaveLength(1);
    const file = files[0];
    const geoJson = await parseGeoJson(file);
    expect(geoJson.type).toBe("FeatureCollection");
    expect(Array.isArray(geoJson.features)).toBe(true);
    expect(file.fileName).toBe("junctions.geojson");
    expect(file.extensions).toEqual([".geojson"]);
    expect(file.mimeTypes).toEqual(["text/geo+json"]);
    expect(file.description).toBe("GeoJSON File");
  });

  it("includes asset geometry and properties in the feature", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { label: "J1", elevation: 10 })
      .build();
    const files = exportGeoJson(model, WGS84, translate);

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
    const files = exportGeoJson(model, WGS84, translate);

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
    const files = exportGeoJson(model, WGS84, translate);

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

    const files = exportGeoJson(model, WGS84, translate, {
      includeSimulationResults: true,
      resultsReader,
    });

    const geoJson = await parseGeoJson(findFile(files, "junctions.geojson"));
    expect(geoJson.features[0].properties).toMatchObject({
      "pressure (simulation)": 42,
      "demand (simulation)": 5,
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
    const files = exportGeoJson(model, WGS84, translate);

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
      junction: "J1",
      pipe: "P1",
    });
  });

  it("exports customer points with empty connection when unconnected", async () => {
    const model = HydraulicModelBuilder.with()
      .aCustomerPoint(10, { label: "CP1", coordinates: [0, 0] })
      .build();
    const files = exportGeoJson(model, WGS84, translate);

    const geoJson = await parseGeoJson(
      findFile(files, "customer-points.geojson"),
    );

    expect(geoJson.features).toHaveLength(1);
    expect(geoJson.features[0].properties).toMatchObject({
      label: "CP1",
    });
  });

  it(`formats geometry coordinates with ${COORDINATE_DECIMAL_PLACES} decimal places and properties with ${NUM_DECIMAL_PLACES}`, async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, {
        label: "J1",
        coordinates: [1.123456789, 2.987654321],
        elevation: 9.87654321,
      })
      .aPipe(2, { startNodeId: 1, label: "P1" })
      .aCustomerPoint(10, {
        label: "CP1",
        coordinates: [3.111111111, 4.999999999],
        connection: { pipeId: 2, junctionId: 1 },
      })
      .build();
    const files = exportGeoJson(model, WGS84, translate);

    const jGeoJson = await parseGeoJson(findFile(files, "junctions.geojson"));
    const [jx, jy] = jGeoJson.features[0].geometry.coordinates as number[];
    expect(jx).toBe(Number((1.123456789).toFixed(COORDINATE_DECIMAL_PLACES)));
    expect(jy).toBe(Number((2.987654321).toFixed(COORDINATE_DECIMAL_PLACES)));
    expect(jGeoJson.features[0].properties.elevation).toBe(
      Number((9.87654321).toFixed(NUM_DECIMAL_PLACES)),
    );

    const cpGeoJson = await parseGeoJson(
      findFile(files, "customer-points.geojson"),
    );
    const cp = cpGeoJson.features[0];
    const [cpx, cpy] = cp.geometry.coordinates as number[];
    expect(cpx).toBe(Number((3.111111111).toFixed(COORDINATE_DECIMAL_PLACES)));
    expect(cpy).toBe(Number((4.999999999).toFixed(COORDINATE_DECIMAL_PLACES)));
    expect(cp.properties.connectionX).toBe(
      Number((3.111111111).toFixed(COORDINATE_DECIMAL_PLACES)),
    );
    expect(cp.properties.connectionY).toBe(
      Number((4.999999999).toFixed(COORDINATE_DECIMAL_PLACES)),
    );
  });

  it("only exports selected assets when selectedAssets is non-empty", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { label: "J1" })
      .aJunction(2, { label: "J2" })
      .build();
    const files = exportGeoJson(model, WGS84, translate, {
      assetIdsFilter: new Set([1]),
    });

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

    const files = exportGeoJson(model, xyGrid, translate);

    const jGeoJson = await parseGeoJson(findFile(files, "junctions.geojson"));
    const [jx] = jGeoJson.features[0].geometry.coordinates as number[];
    expect(jx).not.toBe(1);

    const cpGeoJson = await parseGeoJson(
      findFile(files, "customer-points.geojson"),
    );
    const [cx] = cpGeoJson.features[0].geometry.coordinates as number[];
    expect(cx).not.toBe(1);
  });

  it("includes a named CRS with the WGS84 EPSG URN for the default projection", async () => {
    const model = HydraulicModelBuilder.with().aJunction(1).build();
    const files = exportGeoJson(model, WGS84, translate);

    const geoJson = await parseGeoJson(findFile(files, "junctions.geojson"));
    expect(geoJson.crs).toEqual({
      type: "name",
      properties: { name: "urn:ogc:def:crs:EPSG::4326" },
    });
  });

  it("includes a named CRS using the projection id for xy-grid projections", async () => {
    const xyGrid = {
      type: "xy-grid" as const,
      id: "my-grid",
      name: "My Grid",
      centroid: [0, 0] as [number, number],
    };
    const model = HydraulicModelBuilder.with().aJunction(1).build();
    const files = exportGeoJson(model, xyGrid, translate);

    const geoJson = await parseGeoJson(findFile(files, "junctions.geojson"));
    expect(geoJson.crs).toEqual({
      type: "name",
      properties: { name: "my-grid" },
    });
  });

  it("includes a named CRS using the projection id as EPSG URN for proj4 projections", async () => {
    const proj4 = {
      type: "proj4" as const,
      id: "EPSG:28355",
      name: "GDA94 / MGA zone 55",
      code: "+proj=utm +zone=55 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
    };
    const model = HydraulicModelBuilder.with().aJunction(1).build();
    const files = exportGeoJson(model, proj4, translate);

    const geoJson = await parseGeoJson(findFile(files, "junctions.geojson"));
    expect(geoJson.crs).toEqual({
      type: "name",
      properties: { name: "urn:ogc:def:crs:EPSG::28355" },
    });
  });

  it("omits the length property for valves and pumps but keeps it for pipes", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1)
      .aJunction(2)
      .aPipe(3, { startNodeId: 1, endNodeId: 2 })
      .aValve(4, { startNodeId: 1, endNodeId: 2 })
      .aPump(5, { startNodeId: 1, endNodeId: 2 })
      .build();
    const files = exportGeoJson(model, WGS84, translate);

    const propsOf = async (name: string) =>
      (await parseGeoJson(findFile(files, name))).features[0].properties;

    expect("length" in (await propsOf("pipes.geojson"))).toBe(true);
    expect("length" in (await propsOf("valves.geojson"))).toBe(false);
    expect("length" in (await propsOf("pumps.geojson"))).toBe(false);
  });

  it("exports EPANET defaults for unmapped optional fields, omits required nulls", async () => {
    const model = HydraulicModelBuilder.with()
      .aPipe(1, { label: "P1", diameter: null })
      .build();
    const pipe = model.assets.get(1)!;
    pipe.setProperty("minorLoss", undefined);

    const geoJson = await parseGeoJson(
      findFile(exportGeoJson(model, WGS84, translate), "pipes.geojson"),
    );
    const properties = geoJson.features[0].properties;

    expect(properties.minorLoss).toBe(0);
    expect("diameter" in properties).toBe(false);
  });

  it("localizes property keys", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { label: "J1", elevation: 10 })
      .build();
    const translations: Record<string, string> = {
      elevation: "Elevación",
      label: "Etiqueta",
    };
    const translateStub = (key: string) => translations[key] ?? key;

    const geoJson = await parseGeoJson(
      findFile(exportGeoJson(model, WGS84, translateStub), "junctions.geojson"),
    );
    const properties = geoJson.features[0].properties;

    expect(properties["Elevación"]).toBe(10);
    expect(properties["Etiqueta"]).toBe("J1");
    expect("elevation" in properties).toBe(false);
  });

  it("uses custom attribute labels as property keys", async () => {
    const model = HydraulicModelBuilder.with()
      .aCustomAttribute("junction", {
        id: "custom-1",
        label: "Zone",
        type: "text",
      })
      .aJunction(1, { label: "J1" })
      .build();
    model.assets.get(1)!.setProperty("custom-1", "north");

    const geoJson = await parseGeoJson(
      findFile(exportGeoJson(model, WGS84, translate), "junctions.geojson"),
    );
    const properties = geoJson.features[0].properties;

    expect(properties.Zone).toBe("north");
    expect("custom-1" in properties).toBe(false);
  });

  it("marks localized simulation properties", async () => {
    const model = HydraulicModelBuilder.with().aJunction(1).build();
    const resultsReader = {
      getJunction: vi.fn().mockReturnValue({ pressure: 42 }),
      getTank: vi.fn().mockReturnValue({}),
      getReservoir: vi.fn().mockReturnValue({}),
      getPipe: vi.fn().mockReturnValue({}),
      getPump: vi.fn().mockReturnValue({}),
      getValve: vi.fn().mockReturnValue({}),
    } as unknown as ResultsReader;
    const translations: Record<string, string> = {
      pressure: "Presión",
      simulation: "Simulación",
    };
    const translateStub = (key: string) => translations[key] ?? key;

    const geoJson = await parseGeoJson(
      findFile(
        exportGeoJson(model, WGS84, translateStub, {
          includeSimulationResults: true,
          resultsReader,
        }),
        "junctions.geojson",
      ),
    );
    const properties = geoJson.features[0].properties;

    expect(properties["Presión (Simulación)"]).toBe(42);
    expect("sim_pressure" in properties).toBe(false);
  });
});

const findFile = (files: ExportedFile[], name: string) =>
  files.find((f) => f.fileName === name)!;

const parseGeoJson = async (file: ExportedFile) =>
  JSON.parse(await file.blob.text()) as {
    type: string;
    crs?: { type: string; properties: { name: string } };
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
