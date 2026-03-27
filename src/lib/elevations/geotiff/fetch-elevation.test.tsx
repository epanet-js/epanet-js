import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

import { GeoTiffTile } from ".";
import { parseGeoTIFF } from "./parse-geotiff";
import { fetchGeoTiffTileElevation } from "./fetch-elevation";

function loadFixtureAsFile(filename: string): File {
  const buffer = fs.readFileSync(path.join(__dirname, filename));
  return new File([new Uint8Array(buffer)], filename, { type: "image/tiff" });
}

const fetchProj4DefFake = vi.fn().mockResolvedValue("");

async function loadFixtureTile(
  overrides?: Partial<GeoTiffTile>,
): Promise<GeoTiffTile> {
  const file = loadFixtureAsFile("elevation.fixture.tif");
  const metadata = await parseGeoTIFF(file, fetchProj4DefFake);
  return { id: "test", ...metadata, ...overrides };
}

// Fixture: 4x4 float32 grid, origin (-4, 56), pixel size 0.25°, WGS84
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
