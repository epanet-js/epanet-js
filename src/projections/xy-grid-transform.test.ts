import {
  computeCentroid,
  transformPoint,
  METERS_PER_DEGREE,
} from "./xy-grid-transform";

describe("xy-grid-transform", () => {
  describe("computeCentroid", () => {
    it("returns the average of all points", () => {
      const centroid = computeCentroid([
        [0, 0],
        [200, 400],
      ]);
      expect(centroid).toEqual([100, 200]);
    });

    it("handles a single point", () => {
      const centroid = computeCentroid([[42, 99]]);
      expect(centroid).toEqual([42, 99]);
    });
  });

  describe("transformPoint", () => {
    it("centers a point relative to centroid and scales", () => {
      const centroid: [number, number] = [100, 100];
      const result = transformPoint([200, 300], centroid);
      expect(result[0]).toBeCloseTo(100 / METERS_PER_DEGREE, 6);
      expect(result[1]).toBeCloseTo(200 / METERS_PER_DEGREE, 6);
    });

    it("clamps to WGS84 bounds", () => {
      const centroid: [number, number] = [0, 0];
      const result = transformPoint([999_999_999, 999_999_999], centroid);
      expect(result[0]).toBe(180);
      expect(result[1]).toBe(90);
    });
  });
});
