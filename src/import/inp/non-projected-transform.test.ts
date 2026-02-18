import { nullInpData } from "./inp-data";
import { transformNonProjectedCoordinates } from "./non-projected-transform";
import { METERS_PER_DEGREE } from "src/projections";

describe("transformNonProjectedCoordinates", () => {
  it("centers coordinates at the origin", () => {
    const inpData = nullInpData();
    inpData.coordinates.set("N1", [500000, 200000]);
    inpData.coordinates.set("N2", [502000, 204000]);

    transformNonProjectedCoordinates(inpData);

    const n1 = inpData.coordinates.get("N1")!;
    const n2 = inpData.coordinates.get("N2")!;
    expect(n1[0]).toBeCloseTo(-1000 / METERS_PER_DEGREE, 6);
    expect(n1[1]).toBeCloseTo(-2000 / METERS_PER_DEGREE, 6);
    expect(n2[0]).toBeCloseTo(1000 / METERS_PER_DEGREE, 6);
    expect(n2[1]).toBeCloseTo(2000 / METERS_PER_DEGREE, 6);
  });

  it("preserves proportions between points", () => {
    const inpData = nullInpData();
    inpData.coordinates.set("N1", [0, 0]);
    inpData.coordinates.set("N2", [1000, 0]);
    inpData.coordinates.set("N3", [0, 2000]);

    transformNonProjectedCoordinates(inpData);

    const n1 = inpData.coordinates.get("N1")!;
    const n2 = inpData.coordinates.get("N2")!;
    const n3 = inpData.coordinates.get("N3")!;

    const dx12 = n2[0] - n1[0];
    const dy13 = n3[1] - n1[1];
    expect(dy13 / dx12).toBeCloseTo(2, 6);
  });

  it("transforms vertices alongside coordinates", () => {
    const inpData = nullInpData();
    inpData.coordinates.set("N1", [100000, 100000]);
    inpData.coordinates.set("N2", [102000, 102000]);
    inpData.vertices.set("P1", [
      [101000, 101500],
      [101500, 101000],
    ]);

    transformNonProjectedCoordinates(inpData);

    const vertices = inpData.vertices.get("P1")!;
    expect(vertices).toHaveLength(2);
    for (const v of vertices) {
      expect(v[0]).toBeGreaterThanOrEqual(-180);
      expect(v[0]).toBeLessThanOrEqual(180);
      expect(v[1]).toBeGreaterThanOrEqual(-90);
      expect(v[1]).toBeLessThanOrEqual(90);
    }
  });

  it("produces valid WGS84 coordinates", () => {
    const inpData = nullInpData();
    inpData.coordinates.set("N1", [500000, 200000]);
    inpData.coordinates.set("N2", [500100, 200100]);

    transformNonProjectedCoordinates(inpData);

    for (const [, pos] of inpData.coordinates.entries()) {
      expect(pos[0]).toBeGreaterThanOrEqual(-180);
      expect(pos[0]).toBeLessThanOrEqual(180);
      expect(pos[1]).toBeGreaterThanOrEqual(-90);
      expect(pos[1]).toBeLessThanOrEqual(90);
    }
  });

  it("handles empty coordinates gracefully", () => {
    const inpData = nullInpData();
    expect(() => transformNonProjectedCoordinates(inpData)).not.toThrow();
  });

  it("includes vertices in centroid calculation", () => {
    const inpData = nullInpData();
    inpData.coordinates.set("N1", [0, 0]);
    inpData.coordinates.set("N2", [0, 0]);
    inpData.vertices.set("P1", [[300, 300]]);

    transformNonProjectedCoordinates(inpData);

    // Centroid = (0+0+300)/3, (0+0+300)/3 = (100, 100)
    const n1 = inpData.coordinates.get("N1")!;
    expect(n1[0]).toBeCloseTo(-100 / METERS_PER_DEGREE, 6);
    expect(n1[1]).toBeCloseTo(-100 / METERS_PER_DEGREE, 6);
  });
});
