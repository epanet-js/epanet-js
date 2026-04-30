import { AssetWriter } from "./asset-writer";
import { freezeSchema, ensureField } from "./schema";

const encoder = new TextEncoder();

function makeWriter(shapeType: 1 | 3, fieldDefs: { key: string; type: "C" | "N" | "L"; length: number; decimals?: number }[] = []) {
  const w = new AssetWriter(shapeType);
  for (const f of fieldDefs) {
    const info = ensureField(w.fields, f.key);
    info.dbfType = f.type;
    info.maxLength = f.length;
    info.maxDecimals = f.decimals ?? 0;
  }
  w.frozenSchema = freezeSchema(w.fields, encoder);
  return w;
}

describe("AssetWriter constructor", () => {
  it("stores shapeType", () => {
    expect(new AssetWriter(1).shapeType).toBe(1);
    expect(new AssetWriter(3).shapeType).toBe(3);
  });

  it("initialises counters and collections to defaults", () => {
    const w = new AssetWriter(1);
    expect(w.recordCount).toBe(0);
    expect(w.shpBodyBytes).toBe(0);
    expect(w.fields.size).toBe(0);
    expect(w.frozenSchema).toEqual([]);
    expect(w.bbox).toEqual({ xmin: Infinity, ymin: Infinity, xmax: -Infinity, ymax: -Infinity });
  });
});

describe("AssetWriter.nextRecordIndex", () => {
  it("returns 1-based incrementing indices", () => {
    const w = new AssetWriter(1);
    expect(w.nextRecordIndex()).toBe(1);
    expect(w.nextRecordIndex()).toBe(2);
    expect(w.nextRecordIndex()).toBe(3);
  });
});

describe("AssetWriter.allocate", () => {
  it("allocates shp buffer of 100 + shpBodyBytes", () => {
    const w = makeWriter(1);
    w.shpBodyBytes = 28;
    w.recordCount = 1;
    w.allocate();
    expect(w.shp.length).toBe(128);
    expect(w.shpCursor).toBe(100);
  });

  it("allocates shx buffer of 100 + 8 * recordCount", () => {
    const w = makeWriter(1);
    w.recordCount = 5;
    w.shpBodyBytes = 140;
    w.allocate();
    expect(w.shx.length).toBe(100 + 8 * 5);
    expect(w.shxCursor).toBe(100);
  });

  it("computes recordLength as 1 (flag) + sum of field lengths", () => {
    const w = makeWriter(1, [
      { key: "name", type: "C", length: 10 },
      { key: "value", type: "N", length: 8, decimals: 2 },
    ]);
    w.recordCount = 1;
    w.shpBodyBytes = 28;
    w.allocate();
    expect(w.recordLength).toBe(1 + 10 + 8);
  });

  it("allocates dbf buffer of correct size with no fields", () => {
    const w = makeWriter(1);
    w.recordCount = 3;
    w.shpBodyBytes = 84;
    w.allocate();
    // dbfSize = 32 + 32*0 + 1 + recordLength(1) * 3 + 1 = 37
    expect(w.dbf.length).toBe(32 + 1 + 1 * 3 + 1);
    expect(w.dbfCursor).toBe(32 + 1); // 32 + 32*0 + 1
  });

  it("sets dbfCursor to start of first record (after header + terminator)", () => {
    const w = makeWriter(1, [{ key: "x", type: "C", length: 5 }]);
    w.recordCount = 2;
    w.shpBodyBytes = 56;
    w.allocate();
    // header = 32 + 32*1 + 1 = 65
    expect(w.dbfCursor).toBe(65);
  });
});
