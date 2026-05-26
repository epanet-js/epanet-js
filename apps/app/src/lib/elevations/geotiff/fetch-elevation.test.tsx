import { describe, it, expect, vi } from "vitest";

import { GeoTiffTile } from ".";
import { parseGeoTIFF } from "./parse-geotiff";
import {
  fetchGeoTiffTileElevation,
  fetchGeoTiffTileElevationsForPoints,
} from "./fetch-elevation";
import { buildFixture } from "src/__helpers__/geotiff-fixture";
import { GeoKey, ModelType, RasterType } from "./spec";

const fetchProj4DefFake = vi.fn().mockResolvedValue("");

// 4x4 float32 grid, origin (-4, 56), pixel size 0.25°, WGS84
// bbox: [-4, 55, -3, 56], nodata: -9999
// Values (pixel centers at integer + 0.5 in pixel coords):
//   (0,0)=100, (1,0)=110, (2,0)=120, (3,0)=130
//   (0,1)=105, (1,1)=115, (2,1)=125, (3,1)=135
//   (0,2)=110, (1,2)=120, (2,2)=-9999, (3,2)=140
//   (0,3)=115, (1,3)=125, (2,3)=135, (3,3)=145
//
// Pixel center coords (lng, lat):
//   pixel (0,0) center → (-3.875, 55.875)
//   pixel (1,1) center → (-3.625, 55.625)
//   pixel (3,3) center → (-3.125, 55.125)
// Midpoint between pixel centers:
//   between (0,0),(1,0),(0,1),(1,1) → (-3.75, 55.75)

// prettier-ignore
const ELEVATION_RASTER = new Float32Array([
  100, 110, 120,   130,
  105, 115, 125,   135,
  110, 120, -9999, 140,
  115, 125, 135,   145,
]);

function elevationFixture() {
  return buildFixture({
    flatRaster: { data: ELEVATION_RASTER, width: 4, height: 4 },
    noDataValue: -9999,
    tiepoint: [0, 0, 0, -4, 56, 0],
    pixelScale: [0.25, 0.25, 0],
    geoKeys: {
      [GeoKey.GTModelType]: ModelType.Geographic,
      [GeoKey.GTRasterType]: RasterType.PixelIsArea,
      [GeoKey.GeographicType]: 4326,
    },
  });
}

async function loadFixtureTile(
  overrides?: Partial<GeoTiffTile>,
): Promise<GeoTiffTile> {
  const file = elevationFixture();
  const metadata = await parseGeoTIFF(file, fetchProj4DefFake);
  return { id: "test", ...metadata, ...overrides };
}

describe("fetchGeoTiffTileElevation", () => {
  it("returns exact pixel value at pixel center", async () => {
    const tile = await loadFixtureTile();

    // Pixel (0,0) center = 100
    expect(await fetchGeoTiffTileElevation(tile, -3.875, 55.875)).toEqual({
      value: 100,
      unit: "m",
    });

    // Pixel (1,1) center = 115
    expect(await fetchGeoTiffTileElevation(tile, -3.625, 55.625)).toEqual({
      value: 115,
      unit: "m",
    });

    // Pixel (3,3) center = 145
    expect(await fetchGeoTiffTileElevation(tile, -3.125, 55.125)).toEqual({
      value: 145,
      unit: "m",
    });
  });

  it("interpolates between pixel centers", async () => {
    const tile = await loadFixtureTile();

    // Midpoint between pixels (0,0)=100, (1,0)=110, (0,1)=105, (1,1)=115
    // Equal weights → (100+110+105+115)/4 = 107.5
    expect(await fetchGeoTiffTileElevation(tile, -3.75, 55.75)).toEqual({
      value: 107.5,
      unit: "m",
    });
  });

  it("weights the closer neighbor more along X axis", async () => {
    const tile = await loadFixtureTile();

    // 25% of the way from pixel (0,0)=100 to pixel (1,0)=110, Y at pixel 0 center
    // fractionX=0.25 → 75% pixel 0 + 25% pixel 1 = 102.5
    expect(await fetchGeoTiffTileElevation(tile, -3.8125, 55.875)).toEqual({
      value: 102.5,
      unit: "m",
    });

    // 75% of the way from pixel (0,0)=100 to pixel (1,0)=110, Y at pixel 0 center
    // fractionX=0.75 → 25% pixel 0 + 75% pixel 1 = 107.5
    expect(await fetchGeoTiffTileElevation(tile, -3.6875, 55.875)).toEqual({
      value: 107.5,
      unit: "m",
    });
  });

  it("weights the closer neighbor more along Y axis", async () => {
    const tile = await loadFixtureTile();

    // 25% of the way from pixel (0,0)=100 to pixel (0,1)=105, X at pixel 0 center
    // fractionY=0.25 → 75% pixel 0 + 25% pixel 1 = 101.25
    expect(await fetchGeoTiffTileElevation(tile, -3.875, 55.8125)).toEqual({
      value: 101.25,
      unit: "m",
    });

    // 75% of the way from pixel (0,0)=100 to pixel (0,1)=105, X at pixel 0 center
    // fractionY=0.75 → 25% pixel 0 + 75% pixel 1 = 103.75
    expect(await fetchGeoTiffTileElevation(tile, -3.875, 55.6875)).toEqual({
      value: 103.75,
      unit: "m",
    });
  });

  it("renormalizes weights when a neighbor is nodata", async () => {
    const tile = await loadFixtureTile();

    // Midpoint between pixels (1,1)=115, (2,1)=125, (1,2)=120, (2,2)=-9999
    // 3 valid pixels with equal weights → (115+125+120)/3 = 120
    expect(await fetchGeoTiffTileElevation(tile, -3.5, 55.5)).toEqual({
      value: 120,
      unit: "m",
    });
  });

  it("returns null for nodata pixel center", async () => {
    const tile = await loadFixtureTile();

    // Pixel (2,2) center = -9999 (nodata), gets all weight → null
    expect(await fetchGeoTiffTileElevation(tile, -3.375, 55.375)).toBeNull();
  });

  it("returns null when pixel is out of bounds", async () => {
    const tile = await loadFixtureTile();

    expect(await fetchGeoTiffTileElevation(tile, -5, 55.5)).toBeNull();
    expect(await fetchGeoTiffTileElevation(tile, -3.5, 57)).toBeNull();
  });

  it("applies scaleZ to interpolated values", async () => {
    const tile = await loadFixtureTile({ scaleZ: 0.1 });

    // Pixel (0,0) center raw = 100, scaled = 10
    expect(await fetchGeoTiffTileElevation(tile, -3.875, 55.875)).toEqual({
      value: 10,
      unit: "m",
    });
  });

  it("applies GDAL scale and offset to interpolated values", async () => {
    const tile = await loadFixtureTile({ gdalScale: 0.1, gdalOffset: -10 });

    // Pixel (0,0) center raw = 100, gdal = 100 * 0.1 + (-10) = 0
    expect(await fetchGeoTiffTileElevation(tile, -3.875, 55.875)).toEqual({
      value: 0,
      unit: "m",
    });

    // Pixel (1,1) center raw = 115, gdal = 115 * 0.1 + (-10) = 1.5
    expect(await fetchGeoTiffTileElevation(tile, -3.625, 55.625)).toEqual({
      value: 1.5,
      unit: "m",
    });
  });

  it("applies GDAL offset only when scale is absent", async () => {
    const tile = await loadFixtureTile({ gdalOffset: 50 });

    // Pixel (0,0) center raw = 100, gdal = 100 + 50 = 150
    expect(await fetchGeoTiffTileElevation(tile, -3.875, 55.875)).toEqual({
      value: 150,
      unit: "m",
    });
  });

  it("applies both GDAL scale/offset and scaleZ", async () => {
    const tile = await loadFixtureTile({
      gdalScale: 0.1,
      gdalOffset: 0,
      scaleZ: 2,
    });

    // Pixel (0,0) center raw = 100, gdal = 10, scaleZ = 20
    expect(await fetchGeoTiffTileElevation(tile, -3.875, 55.875)).toEqual({
      value: 20,
      unit: "m",
    });
  });

  it("returns units from file", async () => {
    const tile = await loadFixtureTile({ verticalUnit: "ft" });

    const inFeet = await fetchGeoTiffTileElevation(tile, -3.875, 55.875);
    expect(inFeet).toEqual({ value: 100, unit: "ft" });
  });
});

describe("fetchGeoTiffTileElevationsForPoints", () => {
  it("returns empty array for empty input", async () => {
    const tile = await loadFixtureTile();
    const readSpy = vi.spyOn(tile.image, "readRasters");

    const result = await fetchGeoTiffTileElevationsForPoints(tile, []);

    expect(result).toEqual([]);
    expect(readSpy).not.toHaveBeenCalled();
  });

  it("returns same values as the single-point function", async () => {
    const tile = await loadFixtureTile();
    const points = [
      { lng: -3.875, lat: 55.875 }, // pixel (0,0) center = 100
      { lng: -3.625, lat: 55.625 }, // pixel (1,1) center = 115
      { lng: -3.125, lat: 55.125 }, // pixel (3,3) center = 145
      { lng: -3.75, lat: 55.75 }, // midpoint = 107.5
    ];

    const results = await fetchGeoTiffTileElevationsForPoints(tile, points);

    expect(results).toEqual([
      { value: 100, unit: "m" },
      { value: 115, unit: "m" },
      { value: 145, unit: "m" },
      { value: 107.5, unit: "m" },
    ]);
  });

  it("reads the raster once for many points in the same tile", async () => {
    const tile = await loadFixtureTile();
    const readSpy = vi.spyOn(tile.image, "readRasters");

    const points = [
      { lng: -3.875, lat: 55.875 },
      { lng: -3.625, lat: 55.625 },
      { lng: -3.125, lat: 55.125 },
      { lng: -3.75, lat: 55.75 },
    ];

    await fetchGeoTiffTileElevationsForPoints(tile, points);

    expect(readSpy).toHaveBeenCalledTimes(1);
  });

  it("returns null for out-of-bounds points without losing in-bounds results", async () => {
    const tile = await loadFixtureTile();
    const points = [
      { lng: -3.875, lat: 55.875 }, // in bounds → 100
      { lng: -10, lat: 55.5 }, // out west
      { lng: -3.5, lat: 60 }, // out north
      { lng: -3.625, lat: 55.625 }, // in bounds → 115
    ];

    const results = await fetchGeoTiffTileElevationsForPoints(tile, points);

    expect(results[0]).toEqual({ value: 100, unit: "m" });
    expect(results[1]).toBeNull();
    expect(results[2]).toBeNull();
    expect(results[3]).toEqual({ value: 115, unit: "m" });
  });

  it("skips the raster read when all points are out of bounds", async () => {
    const tile = await loadFixtureTile();
    const readSpy = vi.spyOn(tile.image, "readRasters");

    const results = await fetchGeoTiffTileElevationsForPoints(tile, [
      { lng: -10, lat: 55.5 },
      { lng: -3.5, lat: 60 },
    ]);

    expect(results).toEqual([null, null]);
    expect(readSpy).not.toHaveBeenCalled();
  });

  it("returns null at nodata pixel centers", async () => {
    const tile = await loadFixtureTile();
    const points = [
      { lng: -3.375, lat: 55.375 }, // pixel (2,2) center = nodata
      { lng: -3.875, lat: 55.875 }, // pixel (0,0) center = 100
    ];

    const results = await fetchGeoTiffTileElevationsForPoints(tile, points);

    expect(results).toEqual([null, { value: 100, unit: "m" }]);
  });

  it("applies scaleZ and GDAL scale/offset uniformly", async () => {
    const tile = await loadFixtureTile({
      gdalScale: 0.1,
      gdalOffset: -10,
      scaleZ: 2,
    });

    const results = await fetchGeoTiffTileElevationsForPoints(tile, [
      { lng: -3.875, lat: 55.875 }, // 100 * 0.1 + (-10) = 0, * 2 = 0
      { lng: -3.625, lat: 55.625 }, // 115 * 0.1 + (-10) = 1.5, * 2 = 3
    ]);

    expect(results).toEqual([
      { value: 0, unit: "m" },
      { value: 3, unit: "m" },
    ]);
  });
});

/**
 * Synthetic tile factory for cell-bucketing tests. crsToPixel is identity, so
 * lng=lat=k maps to pixel (k, k). Width/height are 2000 to match the user's
 * real tile size and exercise multi-cell behavior.
 */
function aSyntheticTile(width = 2000, height = 2000): GeoTiffTile {
  return {
    id: "synth",
    file: new File([""], "synth.tif"),
    width,
    height,
    bbox: [0, 0, width, height],
    resolution: [1, 1] as [number, number],
    crsUnit: "deg",
    verticalUnit: "m",
    pixelToCrs: [0, 1, 0, 0, 0, 1],
    crsToPixel: [0, 1, 0, 0, 0, 1],
    noDataValue: -9999,
    image: {
      readRasters: vi.fn(
        ({ window }: { window: number[] } = { window: [] }) => {
          const [x0, y0, x1, y1] = window;
          const size = Math.max(1, (x1 - x0) * (y1 - y0));
          // Encode the window's top-left into the value so we can verify which
          // window each point's elevation came from.
          return Promise.resolve([
            Float32Array.from({ length: size }, () => x0 + y0),
          ]);
        },
      ),
    } as unknown as GeoTiffTile["image"],
  };
}

describe("fetchGeoTiffTileElevationsForPoints — cell bucketing", () => {
  it("issues a single read for points clustered in the same cell", async () => {
    const tile = aSyntheticTile();
    const readSpy = vi.mocked(tile.image.readRasters);

    await fetchGeoTiffTileElevationsForPoints(tile, [
      { lng: 10, lat: 10 },
      { lng: 12, lat: 14 },
      { lng: 20, lat: 30 },
      { lng: 100, lat: 100 },
    ]);

    expect(readSpy).toHaveBeenCalledTimes(1);
  });

  it("issues separate reads for points in different cells", async () => {
    const tile = aSyntheticTile();
    const readSpy = vi.mocked(tile.image.readRasters);

    await fetchGeoTiffTileElevationsForPoints(tile, [
      { lng: 10, lat: 10 }, // cell (0,0)
      { lng: 600, lat: 600 }, // cell (2,2)
      { lng: 1500, lat: 1500 }, // cell (5,5)
    ]);

    expect(readSpy).toHaveBeenCalledTimes(3);
  });

  it("keeps each read window small even when the points span the raster", async () => {
    const tile = aSyntheticTile();
    const readSpy = vi.mocked(tile.image.readRasters);

    // Diagonal path crossing the raster — old union-window code would read
    // the whole 2000×2000 raster in one go.
    await fetchGeoTiffTileElevationsForPoints(tile, [
      { lng: 50, lat: 50 },
      { lng: 500, lat: 500 },
      { lng: 1000, lat: 1000 },
      { lng: 1500, lat: 1500 },
      { lng: 1950, lat: 1950 },
    ]);

    const widestRead = readSpy.mock.calls.reduce((max, [arg]) => {
      const w = (arg as { window: number[] }).window;
      const width = w[2] - w[0];
      const height = w[3] - w[1];
      return Math.max(max, width, height);
    }, 0);

    // Cell bucket is 256 px; per-bucket union may extend by ~2 px for the
    // bilinear neighborhood. Stay well under the 2000 px raster size.
    expect(widestRead).toBeLessThan(300);
    expect(readSpy).toHaveBeenCalledTimes(5);
  });

  it("preserves point→bucket association so each result reflects its own pixel", async () => {
    const tile = aSyntheticTile();

    // Synthetic readRasters returns (x0 + y0) for every pixel in the window,
    // so the elevation for a point reveals the top-left of the window it was
    // read from. Verifies points aren't being cross-pollinated by bucket.
    const results = await fetchGeoTiffTileElevationsForPoints(tile, [
      { lng: 10, lat: 10 }, // cell (0,0), window starts at (9,9) → 18
      { lng: 600, lat: 600 }, // cell (2,2), window starts at (599,599) → 1198
    ]);

    expect(results[0]?.value).toBe(18);
    expect(results[1]?.value).toBe(1198);
  });
});
