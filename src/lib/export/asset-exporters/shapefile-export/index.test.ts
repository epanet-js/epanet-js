import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { exportShapefiles } from "./index";
import { WGS84 } from "src/lib/projections";

// Helpers to read blobs in tests (Node environment)
async function blobBytes(blob: Blob): Promise<Uint8Array> {
  const buf = await blob.arrayBuffer();
  return new Uint8Array(buf);
}

async function blobView(blob: Blob): Promise<DataView> {
  const buf = await blob.arrayBuffer();
  return new DataView(buf);
}

async function blobText(blob: Blob): Promise<string> {
  return blob.text();
}

function fileNames(files: { fileName: string }[]) {
  return files.map((f) => f.fileName);
}

describe("exportShapefiles", () => {
  it("returns 5 files per non-empty asset type (shp, shx, dbf, prj, cpg)", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { coordinates: [10, 20] })
      .build();

    const files = exportShapefiles(model, WGS84);
    expect(files.length).toBe(5);
    expect(fileNames(files)).toEqual(
      expect.arrayContaining([
        "junctions.shp",
        "junctions.shx",
        "junctions.dbf",
        "junctions.prj",
        "junctions.cpg",
      ]),
    );
  });

  it("omits asset types with zero records", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { coordinates: [0, 0] })
      .build();

    const files = exportShapefiles(model, WGS84);
    const names = fileNames(files);
    expect(names.some((n) => n.startsWith("pipes."))).toBe(false);
    expect(names.some((n) => n.startsWith("junctions."))).toBe(true);
  });

  it("produces one group of 5 files per asset type", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { coordinates: [0, 0] })
      .aJunction(2, { coordinates: [1, 1] })
      .aPipe(3, { startNodeId: 1, endNodeId: 2 })
      .build();

    const files = exportShapefiles(model, WGS84);
    // junction × 5 + pipe × 5 = 10
    expect(files.length).toBe(10);
  });

  it("filters to selectedAssets when set is non-empty", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { coordinates: [0, 0] })
      .aJunction(2, { coordinates: [5, 5] })
      .build();

    const files = exportShapefiles(model, WGS84, {
      selectedAssets: new Set([1]),
    });
    const dbfFile = files.find((f) => f.fileName === "junctions.dbf")!;
    // record count in DBF header (bytes 4-7, little-endian)
    return blobView(dbfFile.blob).then((view) => {
      expect(view.getUint32(4, true)).toBe(1);
    });
  });

  it("SHP magic code is 9994 in each .shp file", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { coordinates: [0, 0] })
      .build();

    const files = exportShapefiles(model, WGS84);
    const shpFile = files.find((f) => f.fileName === "junctions.shp")!;
    const view = await blobView(shpFile.blob);
    expect(view.getUint32(0, false)).toBe(0x0000270a);
  });

  it(".prj content is the WGS84 WKT string", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { coordinates: [0, 0] })
      .build();

    const files = exportShapefiles(model, WGS84);
    const prjFile = files.find((f) => f.fileName === "junctions.prj")!;
    const text = await blobText(prjFile.blob);
    expect(text).toContain("WGS 84");
    expect(text).toContain("GEOGCS");
  });

  it(".cpg content is UTF-8", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { coordinates: [0, 0] })
      .build();

    const files = exportShapefiles(model, WGS84);
    const cpgFile = files.find((f) => f.fileName === "junctions.cpg")!;
    expect(await blobText(cpgFile.blob)).toBe("UTF-8");
  });

  it("SHP bbox is patched with correct point coordinates", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { coordinates: [10.5, 20.5] })
      .build();

    const files = exportShapefiles(model, WGS84);
    const shpFile = files.find((f) => f.fileName === "junctions.shp")!;
    const view = await blobView(shpFile.blob);
    expect(view.getFloat64(36, true)).toBeCloseTo(10.5); // xmin
    expect(view.getFloat64(44, true)).toBeCloseTo(20.5); // ymin
    expect(view.getFloat64(52, true)).toBeCloseTo(10.5); // xmax
    expect(view.getFloat64(60, true)).toBeCloseTo(20.5); // ymax
  });

  it("DBF has correct record count for multiple junctions", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { coordinates: [0, 0] })
      .aJunction(2, { coordinates: [1, 1] })
      .aJunction(3, { coordinates: [2, 2] })
      .build();

    const files = exportShapefiles(model, WGS84);
    const dbf = files.find((f) => f.fileName === "junctions.dbf")!;
    const view = await blobView(dbf.blob);
    expect(view.getUint32(4, true)).toBe(3);
  });

  it("DBF EOF marker 0x1A is the last byte", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { coordinates: [0, 0] })
      .build();

    const files = exportShapefiles(model, WGS84);
    const dbf = files.find((f) => f.fileName === "junctions.dbf")!;
    const bytes = await blobBytes(dbf.blob);
    expect(bytes[bytes.length - 1]).toBe(0x1a);
  });

  it("pipe produces a SHAPE_POLYLINE (type 3) shp file", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { coordinates: [0, 0] })
      .aJunction(2, { coordinates: [1, 1] })
      .aPipe(3, { startNodeId: 1, endNodeId: 2 })
      .build();

    const files = exportShapefiles(model, WGS84);
    const shp = files.find((f) => f.fileName === "pipes.shp")!;
    const view = await blobView(shp.blob);
    expect(view.getUint32(32, true)).toBe(3); // shape type in header
  });

  it("pipe DBF has separate startNode and endNode fields with connection labels", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { coordinates: [0, 0] })
      .aJunction(2, { coordinates: [1, 1] })
      .aPipe(3, { startNodeId: 1, endNodeId: 2 })
      .build();

    const files = exportShapefiles(model, WGS84);
    const dbf = files.find((f) => f.fileName === "pipes.dbf")!;
    const bytes = await blobBytes(dbf.blob);
    const text = new TextDecoder("latin1").decode(bytes);
    expect(text).toContain("STARTNODE");
    expect(text).toContain("ENDNODE");
    expect(text).toContain("J1");
    expect(text).toContain("J2");
  });

  it("includes simulation result fields when includeSimulationResults=true", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { coordinates: [0, 0] })
      .build();

    const mockResultsReader = {
      getJunction: () => ({ pressure: 55.5 }),
      getTank: () => ({}),
      getReservoir: () => ({}),
      getPipe: () => ({}),
      getPump: () => ({}),
      getValve: () => ({}),
    } as any;

    const files = exportShapefiles(model, WGS84, {
      includeSimulationResults: true,
      resultsReader: mockResultsReader,
    });
    const dbf = files.find((f) => f.fileName === "junctions.dbf")!;
    const bytes = await blobBytes(dbf.blob);
    // The DBF should contain the field name "PRESSURE" somewhere in the header
    const text = new TextDecoder("latin1").decode(bytes);
    expect(text).toContain("PRESSURE");
  });

  it("SHX has 8 bytes per record after the 100-byte header", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { coordinates: [0, 0] })
      .aJunction(2, { coordinates: [1, 1] })
      .build();

    const files = exportShapefiles(model, WGS84);
    const shx = files.find((f) => f.fileName === "junctions.shx")!;
    const bytes = await blobBytes(shx.blob);
    expect(bytes.length).toBe(100 + 8 * 2);
  });

  it("produces customerPoint files when customer points exist", () => {
    const model = HydraulicModelBuilder.with()
      .aCustomerPoint(1, { coordinates: [5, 10], label: "CP1" })
      .build();

    const files = exportShapefiles(model, WGS84);
    const names = fileNames(files);
    expect(names).toEqual(
      expect.arrayContaining([
        "customer-points.shp",
        "customer-points.shx",
        "customer-points.dbf",
        "customer-points.prj",
        "customer-points.cpg",
      ]),
    );
  });

  it("omits customerPoint files when there are no customer points", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { coordinates: [0, 0] })
      .build();

    const files = exportShapefiles(model, WGS84);
    const names = fileNames(files);
    expect(names.some((n) => n.startsWith("customer-points."))).toBe(false);
  });

  it("customerPoint DBF has correct record count", async () => {
    const model = HydraulicModelBuilder.with()
      .aCustomerPoint(1, { coordinates: [0, 0] })
      .aCustomerPoint(2, { coordinates: [1, 1] })
      .build();

    const files = exportShapefiles(model, WGS84);
    const dbf = files.find((f) => f.fileName === "customer-points.dbf")!;
    const view = await blobView(dbf.blob);
    expect(view.getUint32(4, true)).toBe(2);
  });

  it("customerPoint DBF header contains all expected field names", async () => {
    const model = HydraulicModelBuilder.with()
      .aCustomerPoint(1, { coordinates: [0, 0], label: "CP1" })
      .build();

    const files = exportShapefiles(model, WGS84);
    const dbf = files.find((f) => f.fileName === "customer-points.dbf")!;
    const text = new TextDecoder("latin1").decode(await blobBytes(dbf.blob));
    expect(text).toContain("LABEL");
    expect(text).toContain("POSX");
    expect(text).toContain("POSY");
    expect(text).toContain("JUNCCONN");
    expect(text).toContain("PIPECONN");
  });

  it("customerPoint DBF record contains the point label", async () => {
    const model = HydraulicModelBuilder.with()
      .aCustomerPoint(1, { coordinates: [0, 0], label: "MyPoint" })
      .build();

    const files = exportShapefiles(model, WGS84);
    const dbf = files.find((f) => f.fileName === "customer-points.dbf")!;
    const text = new TextDecoder("latin1").decode(await blobBytes(dbf.blob));
    expect(text).toContain("MyPoint");
  });

  it("customerPoint DBF record contains junction and pipe connection labels", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { label: "J1", coordinates: [0, 0] })
      .aJunction(2, { coordinates: [1, 1] })
      .aPipe(3, { label: "P3", startNodeId: 1, endNodeId: 2 })
      .aCustomerPoint(4, {
        coordinates: [0.5, 0.5],
        connection: { pipeId: 3, junctionId: 1 },
      })
      .build();

    const files = exportShapefiles(model, WGS84);
    const dbf = files.find((f) => f.fileName === "customer-points.dbf")!;
    const text = new TextDecoder("latin1").decode(await blobBytes(dbf.blob));
    expect(text).toContain("J1");
    expect(text).toContain("P3");
  });

  it("customerPoint SHP produces SHAPE_POINT (type 1) records", async () => {
    const model = HydraulicModelBuilder.with()
      .aCustomerPoint(1, { coordinates: [3, 7] })
      .build();

    const files = exportShapefiles(model, WGS84);
    const shp = files.find((f) => f.fileName === "customer-points.shp")!;
    const view = await blobView(shp.blob);
    expect(view.getUint32(32, true)).toBe(1); // shape type in header
  });

  it("customerPoint SHX has 8 bytes per record after the 100-byte header", async () => {
    const model = HydraulicModelBuilder.with()
      .aCustomerPoint(1, { coordinates: [0, 0] })
      .aCustomerPoint(2, { coordinates: [1, 1] })
      .build();

    const files = exportShapefiles(model, WGS84);
    const shx = files.find((f) => f.fileName === "customer-points.shx")!;
    const bytes = await blobBytes(shx.blob);
    expect(bytes.length).toBe(100 + 8 * 2);
  });

  it("transforms SHP coordinates using the given projection", async () => {
    const xyGrid = {
      type: "xy-grid" as const,
      id: "test",
      name: "Test XY Grid",
      centroid: [0, 0] as [number, number],
      scale: 1000,
    };
    const IDS = { J1: 1, CP1: 2 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [1, 0] })
      .aCustomerPoint(IDS.CP1, { coordinates: [1, 0] })
      .build();

    const files = exportShapefiles(model, xyGrid);

    const jShp = files.find((f) => f.fileName === "junctions.shp")!;
    const jView = await blobView(jShp.blob);
    const jx = jView.getFloat64(100 + 12, true);
    expect(jx).not.toBe(1);

    const cpShp = files.find((f) => f.fileName === "customer-points.shp")!;
    const cpView = await blobView(cpShp.blob);
    const cpx = cpView.getFloat64(100 + 12, true);
    expect(cpx).not.toBe(1);
  });

  it(".prj uses the proj4 code string for proj4 projections", async () => {
    const proj4Proj = {
      type: "proj4" as const,
      id: "EPSG:3857",
      name: "WGS 84 / Pseudo-Mercator",
      code: "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs",
    };
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { coordinates: [0, 0] })
      .build();

    const files = exportShapefiles(model, proj4Proj);
    const prjFile = files.find((f) => f.fileName === "junctions.prj")!;
    const text = await blobText(prjFile.blob);
    expect(text).toBe(proj4Proj.code);
  });

  it(".prj uses a LOCAL_CS WKT for xy-grid projections", async () => {
    const xyGrid = {
      type: "xy-grid" as const,
      id: "my-grid",
      name: "My Local Grid",
      centroid: [0, 0] as [number, number],
    };
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { coordinates: [0, 0] })
      .build();

    const files = exportShapefiles(model, xyGrid);
    const prjFile = files.find((f) => f.fileName === "junctions.prj")!;
    const text = await blobText(prjFile.blob);
    expect(text).toContain("LOCAL_CS");
    expect(text).toContain("My Local Grid");
  });
});
