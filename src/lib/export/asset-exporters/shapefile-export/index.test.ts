import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { exportShapefiles } from "./index";

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

    const files = exportShapefiles(model, false, new Set());
    expect(files.length).toBe(5);
    expect(fileNames(files)).toEqual(
      expect.arrayContaining([
        "junction.shp",
        "junction.shx",
        "junction.dbf",
        "junction.prj",
        "junction.cpg",
      ]),
    );
  });

  it("omits asset types with zero records", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { coordinates: [0, 0] })
      .build();

    const files = exportShapefiles(model, false, new Set());
    const names = fileNames(files);
    expect(names.some((n) => n.startsWith("pipe."))).toBe(false);
    expect(names.some((n) => n.startsWith("junction."))).toBe(true);
  });

  it("produces one group of 5 files per asset type", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { coordinates: [0, 0] })
      .aJunction(2, { coordinates: [1, 1] })
      .aPipe(3, { startNodeId: 1, endNodeId: 2 })
      .build();

    const files = exportShapefiles(model, false, new Set());
    // junction × 5 + pipe × 5 = 10
    expect(files.length).toBe(10);
  });

  it("filters to selectedAssets when set is non-empty", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { coordinates: [0, 0] })
      .aJunction(2, { coordinates: [5, 5] })
      .build();

    const files = exportShapefiles(model, false, new Set([1]));
    const dbfFile = files.find((f) => f.fileName === "junction.dbf")!;
    // record count in DBF header (bytes 4-7, little-endian)
    return blobView(dbfFile.blob).then((view) => {
      expect(view.getUint32(4, true)).toBe(1);
    });
  });

  it("SHP magic code is 9994 in each .shp file", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { coordinates: [0, 0] })
      .build();

    const files = exportShapefiles(model, false, new Set());
    const shpFile = files.find((f) => f.fileName === "junction.shp")!;
    const view = await blobView(shpFile.blob);
    expect(view.getUint32(0, false)).toBe(0x0000270a);
  });

  it(".prj content is the WGS84 WKT string", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { coordinates: [0, 0] })
      .build();

    const files = exportShapefiles(model, false, new Set());
    const prjFile = files.find((f) => f.fileName === "junction.prj")!;
    const text = await blobText(prjFile.blob);
    expect(text).toContain("WGS 84");
    expect(text).toContain("GEOGCS");
  });

  it(".cpg content is UTF-8", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { coordinates: [0, 0] })
      .build();

    const files = exportShapefiles(model, false, new Set());
    const cpgFile = files.find((f) => f.fileName === "junction.cpg")!;
    expect(await blobText(cpgFile.blob)).toBe("UTF-8");
  });

  it("SHP bbox is patched with correct point coordinates", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { coordinates: [10.5, 20.5] })
      .build();

    const files = exportShapefiles(model, false, new Set());
    const shpFile = files.find((f) => f.fileName === "junction.shp")!;
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

    const files = exportShapefiles(model, false, new Set());
    const dbf = files.find((f) => f.fileName === "junction.dbf")!;
    const view = await blobView(dbf.blob);
    expect(view.getUint32(4, true)).toBe(3);
  });

  it("DBF EOF marker 0x1A is the last byte", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { coordinates: [0, 0] })
      .build();

    const files = exportShapefiles(model, false, new Set());
    const dbf = files.find((f) => f.fileName === "junction.dbf")!;
    const bytes = await blobBytes(dbf.blob);
    expect(bytes[bytes.length - 1]).toBe(0x1a);
  });

  it("pipe produces a SHAPE_POLYLINE (type 3) shp file", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { coordinates: [0, 0] })
      .aJunction(2, { coordinates: [1, 1] })
      .aPipe(3, { startNodeId: 1, endNodeId: 2 })
      .build();

    const files = exportShapefiles(model, false, new Set());
    const shp = files.find((f) => f.fileName === "pipe.shp")!;
    const view = await blobView(shp.blob);
    expect(view.getUint32(32, true)).toBe(3); // shape type in header
  });

  it("pipe DBF has separate startNode and endNode fields with connection labels", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { coordinates: [0, 0] })
      .aJunction(2, { coordinates: [1, 1] })
      .aPipe(3, { startNodeId: 1, endNodeId: 2 })
      .build();

    const files = exportShapefiles(model, false, new Set());
    const dbf = files.find((f) => f.fileName === "pipe.dbf")!;
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

    const files = exportShapefiles(model, true, new Set(), mockResultsReader);
    const dbf = files.find((f) => f.fileName === "junction.dbf")!;
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

    const files = exportShapefiles(model, false, new Set());
    const shx = files.find((f) => f.fileName === "junction.shx")!;
    const bytes = await blobBytes(shx.blob);
    expect(bytes.length).toBe(100 + 8 * 2);
  });

  it("produces customerPoint files when customer points exist", () => {
    const model = HydraulicModelBuilder.with()
      .aCustomerPoint(1, { coordinates: [5, 10], label: "CP1" })
      .build();

    const files = exportShapefiles(model, false, new Set());
    const names = fileNames(files);
    expect(names).toEqual(
      expect.arrayContaining([
        "customerPoint.shp",
        "customerPoint.shx",
        "customerPoint.dbf",
        "customerPoint.prj",
        "customerPoint.cpg",
      ]),
    );
  });

  it("omits customerPoint files when there are no customer points", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { coordinates: [0, 0] })
      .build();

    const files = exportShapefiles(model, false, new Set());
    const names = fileNames(files);
    expect(names.some((n) => n.startsWith("customerPoint."))).toBe(false);
  });

  it("customerPoint DBF has correct record count", async () => {
    const model = HydraulicModelBuilder.with()
      .aCustomerPoint(1, { coordinates: [0, 0] })
      .aCustomerPoint(2, { coordinates: [1, 1] })
      .build();

    const files = exportShapefiles(model, false, new Set());
    const dbf = files.find((f) => f.fileName === "customerPoint.dbf")!;
    const view = await blobView(dbf.blob);
    expect(view.getUint32(4, true)).toBe(2);
  });

  it("customerPoint DBF header contains all expected field names", async () => {
    const model = HydraulicModelBuilder.with()
      .aCustomerPoint(1, { coordinates: [0, 0], label: "CP1" })
      .build();

    const files = exportShapefiles(model, false, new Set());
    const dbf = files.find((f) => f.fileName === "customerPoint.dbf")!;
    const text = new TextDecoder("latin1").decode(await blobBytes(dbf.blob));
    expect(text).toContain("LABEL");
    expect(text).toContain("X");
    expect(text).toContain("Y");
    expect(text).toContain("JUNCTIONCO");
    expect(text).toContain("PIPECONNEC");
  });

  it("customerPoint DBF record contains the point label", async () => {
    const model = HydraulicModelBuilder.with()
      .aCustomerPoint(1, { coordinates: [0, 0], label: "MyPoint" })
      .build();

    const files = exportShapefiles(model, false, new Set());
    const dbf = files.find((f) => f.fileName === "customerPoint.dbf")!;
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

    const files = exportShapefiles(model, false, new Set());
    const dbf = files.find((f) => f.fileName === "customerPoint.dbf")!;
    const text = new TextDecoder("latin1").decode(await blobBytes(dbf.blob));
    expect(text).toContain("J1");
    expect(text).toContain("P3");
  });

  it("customerPoint SHP produces SHAPE_POINT (type 1) records", async () => {
    const model = HydraulicModelBuilder.with()
      .aCustomerPoint(1, { coordinates: [3, 7] })
      .build();

    const files = exportShapefiles(model, false, new Set());
    const shp = files.find((f) => f.fileName === "customerPoint.shp")!;
    const view = await blobView(shp.blob);
    expect(view.getUint32(32, true)).toBe(1); // shape type in header
  });

  it("customerPoint SHX has 8 bytes per record after the 100-byte header", async () => {
    const model = HydraulicModelBuilder.with()
      .aCustomerPoint(1, { coordinates: [0, 0] })
      .aCustomerPoint(2, { coordinates: [1, 1] })
      .build();

    const files = exportShapefiles(model, false, new Set());
    const shx = files.find((f) => f.fileName === "customerPoint.shx")!;
    const bytes = await blobBytes(shx.blob);
    expect(bytes.length).toBe(100 + 8 * 2);
  });
});
