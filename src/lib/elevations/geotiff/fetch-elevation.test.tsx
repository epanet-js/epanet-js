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
// Values:
//   100, 110, 120, 130
//   105, 115, 125, 135
//   110, 120, -9999, 140
//   115, 125, 135, 145

describe("fetchGeoTiffTileElevation", () => {
  it("returns the elevation value for a valid pixel", async () => {
    const tile = await loadFixtureTile();

    // Pixel (0,0) = 100
    expect(await fetchGeoTiffTileElevation(tile, -3.875, 55.875)).toEqual({
      value: 100,
      unit: "m",
    });

    // Pixel (1,1) = 115
    expect(await fetchGeoTiffTileElevation(tile, -3.625, 55.625)).toEqual({
      value: 115,
      unit: "m",
    });

    // Pixel (3,3) = 145
    expect(await fetchGeoTiffTileElevation(tile, -3.125, 55.125)).toEqual({
      value: 145,
      unit: "m",
    });
  });

  it("returns null for nodata pixels", async () => {
    const tile = await loadFixtureTile();

    // Pixel (2,2) = -9999 (nodata)
    expect(await fetchGeoTiffTileElevation(tile, -3.375, 55.375)).toBeNull();
  });

  it("returns null when pixel is out of bounds", async () => {
    const tile = await loadFixtureTile();

    expect(await fetchGeoTiffTileElevation(tile, -5, 55.5)).toBeNull();
    expect(await fetchGeoTiffTileElevation(tile, -3.5, 57)).toBeNull();
  });

  it("applies scaleZ to raw pixel values", async () => {
    const tile = await loadFixtureTile({ scaleZ: 0.1 });

    // Pixel (0,0) raw = 100, scaled = 10m
    expect(await fetchGeoTiffTileElevation(tile, -3.875, 55.875)).toEqual({
      value: 10,
      unit: "m",
    });
  });

  it("applies GDAL scale and offset to raw pixel values", async () => {
    const tile = await loadFixtureTile({ gdalScale: 0.1, gdalOffset: -10 });

    // Pixel (0,0) raw = 100, unscaled = 100 * 0.1 + (-10) = 0
    expect(await fetchGeoTiffTileElevation(tile, -3.875, 55.875)).toEqual({
      value: 0,
      unit: "m",
    });

    // Pixel (1,1) raw = 115, unscaled = 115 * 0.1 + (-10) = 1.5
    expect(await fetchGeoTiffTileElevation(tile, -3.625, 55.625)).toEqual({
      value: 1.5,
      unit: "m",
    });
  });

  it("applies GDAL offset only when scale is absent", async () => {
    const tile = await loadFixtureTile({ gdalOffset: 50 });

    // Pixel (0,0) raw = 100, unscaled = 100 * 1 + 50 = 150
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

    // Pixel (0,0) raw = 100, gdal = 100 * 0.1 + 0 = 10, then scaleZ = 10 * 2 = 20
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
