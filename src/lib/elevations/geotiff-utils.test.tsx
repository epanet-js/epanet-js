import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  transformCoordinates,
  isPointInBbox,
  sampleElevation,
  extractGeoTiffMetadata,
} from "./geotiff-utils";
import type { GeoTiffTile } from "./elevation-source-types";

function loadFixtureAsFile(filename: string): File {
  const buffer = fs.readFileSync(path.join(__dirname, filename));
  return new File([new Uint8Array(buffer)], filename, { type: "image/tiff" });
}

async function loadFixtureTile(): Promise<GeoTiffTile> {
  const file = loadFixtureAsFile("elevation.fixture.tif");
  const metadata = await extractGeoTiffMetadata(file);
  return { id: "test", ...metadata };
}

describe("transformCoordinates", () => {
  // matrix: [offset_x, scale_x, shear_x, offset_y, shear_y, scale_y]
  const identityMatrix = [0, 1, 0, 0, 0, 1];

  it("applies identity matrix", () => {
    expect(transformCoordinates(5, 10, identityMatrix)).toEqual([5, 10]);
  });

  it("applies scale and offset", () => {
    // origin at (100, 200), pixel size 0.5 in x, -0.5 in y
    const matrix = [100, 0.5, 0, 200, 0, -0.5];
    expect(transformCoordinates(3, 4, matrix)).toEqual([101.5, 198]);
  });

  it("rounds to integer when requested", () => {
    const matrix = [0.5, 1, 0, 0.7, 0, 1];
    expect(transformCoordinates(2, 3, matrix, true)).toEqual([2, 3]);
  });

  it("handles shear terms", () => {
    const matrix = [0, 1, 0.5, 0, 0.5, 1];
    // x = 0 + 1*2 + 0.5*3 = 3.5
    // y = 0 + 0.5*2 + 1*3 = 4
    expect(transformCoordinates(2, 3, matrix)).toEqual([3.5, 4]);
  });
});

describe("isPointInBbox", () => {
  const bbox: [number, number, number, number] = [-4, 55, -3, 56];

  it("returns true for a point inside", () => {
    expect(isPointInBbox(-3.5, 55.5, bbox)).toBe(true);
  });

  it("returns true for a point on the edge", () => {
    expect(isPointInBbox(-4, 55, bbox)).toBe(true);
    expect(isPointInBbox(-3, 56, bbox)).toBe(true);
  });

  it("returns false for a point outside", () => {
    expect(isPointInBbox(-5, 55.5, bbox)).toBe(false);
    expect(isPointInBbox(-3.5, 57, bbox)).toBe(false);
  });
});

// Fixture: 4x4 float32 grid, origin (-4, 56), pixel size 0.25°
// bbox: [-4, 55, -3, 56], nodata: -9999
// Values:
//   100, 110, 120, 130
//   105, 115, 125, 135
//   110, 120, -9999, 140
//   115, 125, 135, 145

describe("extractGeoTiffMetadata", () => {
  it("extracts correct metadata from a GeoTIFF file", async () => {
    const file = loadFixtureAsFile("elevation.fixture.tif");
    const metadata = await extractGeoTiffMetadata(file);

    expect(metadata.width).toBe(4);
    expect(metadata.height).toBe(4);
    expect(metadata.bbox).toEqual([-4, 55, -3, 56]);
    expect(metadata.noDataValue).toBe(-9999);
    expect(metadata.file).toBe(file);
    expect(metadata.image).toBeDefined();
  });
});

describe("sampleElevation", () => {
  it("returns the elevation value for a valid pixel", async () => {
    const tile = await loadFixtureTile();

    // Pixel (0,0) = 100
    expect(await sampleElevation(tile, -3.875, 55.875)).toBe(100);

    // Pixel (1,1) = 115
    expect(await sampleElevation(tile, -3.625, 55.625)).toBe(115);

    // Pixel (3,3) = 145
    expect(await sampleElevation(tile, -3.125, 55.125)).toBe(145);
  });

  it("returns null for nodata pixels", async () => {
    const tile = await loadFixtureTile();

    // Pixel (2,2) = -9999 (nodata)
    expect(await sampleElevation(tile, -3.375, 55.375)).toBeNull();
  });

  it("returns null when pixel is out of bounds", async () => {
    const tile = await loadFixtureTile();

    expect(await sampleElevation(tile, -5, 55.5)).toBeNull();
    expect(await sampleElevation(tile, -3.5, 57)).toBeNull();
  });
});
