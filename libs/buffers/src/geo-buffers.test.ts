import { describe, it, expect } from "vitest";
import Flatbush from "flatbush";
import { GeoIndexBuilder } from "./geo-buffer";

describe("GeoIndexBuilder", () => {
  it("creates valid Flatbush structure", () => {
    const builder = new GeoIndexBuilder(3);
    builder.add([[0, 0]]);
    builder.add([[1, 1]]);
    builder.add([[2, 2]]);

    const geoIndex = builder.finalize();
    expect(geoIndex.byteLength).toBeGreaterThan(0);
  });

  it("handles empty data", () => {
    const builder = new GeoIndexBuilder(0);
    const geoIndex = builder.finalize();
    expect(geoIndex.byteLength).toBeGreaterThan(0);
  });

  it("never matches the placeholder used when empty", () => {
    const builder = new GeoIndexBuilder(0);
    const geoIndex = Flatbush.from(builder.finalize());

    expect(geoIndex.search(-1, -1, 1, 1)).toEqual([]);
    expect(geoIndex.search(-180, -90, 180, 90)).toEqual([]);
    expect(geoIndex.neighbors(0, 0, 1, 1000)).toEqual([]);
  });

  it("handles single point", () => {
    const builder = new GeoIndexBuilder(1);
    builder.add([[5, 10]]);

    const geoIndex = builder.finalize();
    expect(geoIndex.byteLength).toBeGreaterThan(0);
  });

  it("handles line strings", () => {
    const builder = new GeoIndexBuilder(2);
    builder.add([
      [0, 0],
      [10, 10],
    ]);
    builder.add([
      [5, 5],
      [15, 15],
    ]);

    const geoIndex = builder.finalize();
    expect(geoIndex.byteLength).toBeGreaterThan(0);
  });
});
