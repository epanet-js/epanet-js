import { describe, it, expect } from "vitest";

import type { GeoTIFFImage } from "geotiff";
import { GeoTiffTile, tileResolution } from ".";

describe("tileResolution", () => {
  const makeTile = (overrrides: Partial<GeoTiffTile> = {}): GeoTiffTile => ({
    id: "tile-1",
    file: new File([""], "test.tif"),
    width: 100,
    height: 100,
    bbox: [-4, 55, -3, 56],
    resolution: [0.00025, 0.00025],
    pixelToCrs: [0, 0.00025, 0, 0, 0, -0.00025],
    crsToPixel: [0, 4000, 0, 0, 0, -4000],
    noDataValue: null,
    image: {} as GeoTIFFImage,
    crsUnit: "deg",
    verticalUnit: "m",
    ...overrrides,
  });

  it("converts degrees to meters for geographic CRS", () => {
    const tile = makeTile();
    const resolution = tileResolution(tile);

    expect(resolution.value).toBeCloseTo(15.9, 0);
    expect(resolution.unit).toBe("m");
  });

  it("returns resolution in CRS units for projected CRS in meters", () => {
    const tile = makeTile({
      proj4Def: "+proj=tmerc +ellps=GRS80 +units=m",
      crsUnit: "m",
      resolution: [1, 1],
    });
    expect(tileResolution(tile)).toEqual({ value: 1, unit: "m" });
  });

  it("returns feet directly when target unit is feet", () => {
    const source = makeTile({
      proj4Def: "+proj=tmerc +ellps=GRS80 +units=us-ft",
      crsUnit: "us-ft",
      resolution: [5, 5],
    });
    const resolution = tileResolution(source);
    expect(resolution).toEqual({ value: 5, unit: "ft" });
  });
});
