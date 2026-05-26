import { AssetWriter } from "./asset-writer";
import { writePoint, writePolyLine } from "./geometry-writer";

function makeWriter(shapeType: 1 | 3, shpBodyBytes: number) {
  const w = new AssetWriter(shapeType);
  w.recordCount = 1;
  w.shpBodyBytes = shpBodyBytes;
  w.allocate();
  return w;
}

describe("writePoint", () => {
  it("writes record number at byte 0 (big-endian)", () => {
    const w = makeWriter(1, 28);
    writePoint(w, [10, 20], 7);
    expect(w.shpView.getUint32(100, false)).toBe(7);
  });

  it("writes content length = 10 words at byte 4 (big-endian)", () => {
    const w = makeWriter(1, 28);
    writePoint(w, [10, 20], 1);
    expect(w.shpView.getUint32(104, false)).toBe(10);
  });

  it("writes shape type 1 at byte 8 (little-endian)", () => {
    const w = makeWriter(1, 28);
    writePoint(w, [10, 20], 1);
    expect(w.shpView.getUint32(108, true)).toBe(1);
  });

  it("writes X coordinate at bytes 12-19 (little-endian float64)", () => {
    const w = makeWriter(1, 28);
    writePoint(w, [-73.5, 40.2], 1);
    expect(w.shpView.getFloat64(112, true)).toBeCloseTo(-73.5);
  });

  it("writes Y coordinate at bytes 20-27 (little-endian float64)", () => {
    const w = makeWriter(1, 28);
    writePoint(w, [-73.5, 40.2], 1);
    expect(w.shpView.getFloat64(120, true)).toBeCloseTo(40.2);
  });

  it("advances shpCursor by 28", () => {
    const w = makeWriter(1, 28);
    writePoint(w, [0, 0], 1);
    expect(w.shpCursor).toBe(128);
  });

  it("updates bbox from point coordinates", () => {
    const w = makeWriter(1, 56);
    writePoint(w, [5, 10], 1);
    writePoint(w, [-3, 20], 2);
    expect(w.bbox.xmin).toBe(-3);
    expect(w.bbox.xmax).toBe(5);
    expect(w.bbox.ymin).toBe(10);
    expect(w.bbox.ymax).toBe(20);
  });
});

describe("writePolyLine", () => {
  const coords = [
    [0, 0],
    [1, 1],
    [2, 2],
  ];
  const n = coords.length;
  // contentLengthWords = 24 + 8*n = 24 + 24 = 48

  it("writes record number at byte 0 (big-endian)", () => {
    const w = makeWriter(3, 56 + 16 * n);
    writePolyLine(w, coords, 3);
    expect(w.shpView.getUint32(100, false)).toBe(3);
  });

  it("writes content length in words at byte 4 (big-endian)", () => {
    const w = makeWriter(3, 56 + 16 * n);
    writePolyLine(w, coords, 1);
    expect(w.shpView.getUint32(104, false)).toBe(24 + 8 * n);
  });

  it("writes shape type 3 at byte 8 (little-endian)", () => {
    const w = makeWriter(3, 56 + 16 * n);
    writePolyLine(w, coords, 1);
    expect(w.shpView.getUint32(108, true)).toBe(3);
  });

  it("writes line bbox at bytes 12-43", () => {
    const w = makeWriter(3, 56 + 16 * n);
    writePolyLine(
      w,
      [
        [0, 1],
        [2, 3],
      ],
      1,
    );
    expect(w.shpView.getFloat64(112, true)).toBeCloseTo(0); // xmin
    expect(w.shpView.getFloat64(120, true)).toBeCloseTo(1); // ymin
    expect(w.shpView.getFloat64(128, true)).toBeCloseTo(2); // xmax
    expect(w.shpView.getFloat64(136, true)).toBeCloseTo(3); // ymax
  });

  it("writes numParts=1, numPoints=n, parts[0]=0 at bytes 44-55", () => {
    const w = makeWriter(3, 56 + 16 * n);
    writePolyLine(w, coords, 1);
    expect(w.shpView.getUint32(144, true)).toBe(1); // numParts
    expect(w.shpView.getUint32(148, true)).toBe(n); // numPoints
    expect(w.shpView.getUint32(152, true)).toBe(0); // parts[0]
  });

  it("writes point data starting at byte 56", () => {
    const pts = [
      [1.5, 2.5],
      [3.5, 4.5],
    ];
    const w = makeWriter(3, 56 + 16 * pts.length);
    writePolyLine(w, pts, 1);
    expect(w.shpView.getFloat64(156, true)).toBeCloseTo(1.5);
    expect(w.shpView.getFloat64(164, true)).toBeCloseTo(2.5);
    expect(w.shpView.getFloat64(172, true)).toBeCloseTo(3.5);
    expect(w.shpView.getFloat64(180, true)).toBeCloseTo(4.5);
  });

  it("advances shpCursor by 56 + 16*n", () => {
    const w = makeWriter(3, 56 + 16 * n);
    writePolyLine(w, coords, 1);
    expect(w.shpCursor).toBe(100 + 56 + 16 * n);
  });

  it("updates writer bbox across multiple polylines", () => {
    const bodyBytes = 2 * (56 + 16 * 2);
    const w = makeWriter(3, bodyBytes);
    writePolyLine(
      w,
      [
        [10, 20],
        [30, 40],
      ],
      1,
    );
    writePolyLine(
      w,
      [
        [-5, 15],
        [25, 50],
      ],
      2,
    );
    expect(w.bbox.xmin).toBe(-5);
    expect(w.bbox.xmax).toBe(30);
    expect(w.bbox.ymin).toBe(15);
    expect(w.bbox.ymax).toBe(50);
  });
});
