import { AssetWriter } from "./asset-writer";
import { writeShpHeader, writeShxHeader, patchBbox } from "./shp-header";

function makeAllocatedWriter(
  shapeType: 1 | 3,
  recordCount = 1,
  shpBodyBytes = 28,
) {
  const w = new AssetWriter(shapeType);
  w.recordCount = recordCount;
  w.shpBodyBytes = shpBodyBytes;
  w.allocate();
  return w;
}

describe("writeShpHeader", () => {
  it("writes magic file code 9994 at bytes 0-3 (big-endian)", () => {
    const w = makeAllocatedWriter(1);
    writeShpHeader(w);
    expect(w.shpView.getUint32(0, false)).toBe(0x0000270a);
  });

  it("writes file length in 16-bit words at bytes 24-27 (big-endian)", () => {
    const w = makeAllocatedWriter(1, 1, 28);
    writeShpHeader(w);
    const expectedWords = w.shp.length / 2;
    expect(w.shpView.getUint32(24, false)).toBe(expectedWords);
  });

  it("writes version 1000 at bytes 28-31 (little-endian)", () => {
    const w = makeAllocatedWriter(1);
    writeShpHeader(w);
    expect(w.shpView.getUint32(28, true)).toBe(1000);
  });

  it("writes shape type at bytes 32-35 (little-endian)", () => {
    const wPoint = makeAllocatedWriter(1);
    writeShpHeader(wPoint);
    expect(wPoint.shpView.getUint32(32, true)).toBe(1);

    const wLine = makeAllocatedWriter(3, 1, 56);
    writeShpHeader(wLine);
    expect(wLine.shpView.getUint32(32, true)).toBe(3);
  });
});

describe("writeShxHeader", () => {
  it("writes magic file code 9994 at bytes 0-3 (big-endian)", () => {
    const w = makeAllocatedWriter(1);
    writeShxHeader(w);
    expect(w.shxView.getUint32(0, false)).toBe(0x0000270a);
  });

  it("writes file length in words from shx buffer size", () => {
    const w = makeAllocatedWriter(1, 4);
    writeShxHeader(w);
    expect(w.shxView.getUint32(24, false)).toBe(w.shx.length / 2);
  });

  it("writes version 1000 (little-endian)", () => {
    const w = makeAllocatedWriter(1);
    writeShxHeader(w);
    expect(w.shxView.getUint32(28, true)).toBe(1000);
  });

  it("writes shape type (little-endian)", () => {
    const w = makeAllocatedWriter(3, 1, 56);
    writeShxHeader(w);
    expect(w.shxView.getUint32(32, true)).toBe(3);
  });
});

describe("patchBbox", () => {
  it("writes xmin, ymin, xmax, ymax at bytes 36-67 of shp (little-endian float64)", () => {
    const w = makeAllocatedWriter(1);
    w.bbox = { xmin: 10.5, ymin: 20.5, xmax: 30.5, ymax: 40.5 };
    patchBbox(w);

    expect(w.shpView.getFloat64(36, true)).toBeCloseTo(10.5);
    expect(w.shpView.getFloat64(44, true)).toBeCloseTo(20.5);
    expect(w.shpView.getFloat64(52, true)).toBeCloseTo(30.5);
    expect(w.shpView.getFloat64(60, true)).toBeCloseTo(40.5);
  });

  it("patches bbox in shx at the same offsets", () => {
    const w = makeAllocatedWriter(1);
    w.bbox = { xmin: -1, ymin: -2, xmax: 3, ymax: 4 };
    patchBbox(w);

    expect(w.shxView.getFloat64(36, true)).toBeCloseTo(-1);
    expect(w.shxView.getFloat64(44, true)).toBeCloseTo(-2);
    expect(w.shxView.getFloat64(52, true)).toBeCloseTo(3);
    expect(w.shxView.getFloat64(60, true)).toBeCloseTo(4);
  });

  it("patches both shp and shx identically", () => {
    const w = makeAllocatedWriter(1, 2, 56);
    w.bbox = { xmin: 0, ymin: 1, xmax: 2, ymax: 3 };
    patchBbox(w);

    for (const offset of [36, 44, 52, 60]) {
      expect(w.shpView.getFloat64(offset, true)).toBe(
        w.shxView.getFloat64(offset, true),
      );
    }
  });
});
