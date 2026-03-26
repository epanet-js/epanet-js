import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

import { parseGeoTIFF } from "./parse-geotiff";

function loadFixtureAsFile(filename: string): File {
  const buffer = fs.readFileSync(path.join(__dirname, filename));
  return new File([new Uint8Array(buffer)], filename, { type: "image/tiff" });
}

const fetchProj4DefFake = vi.fn().mockResolvedValue("");

// Fixture: 4x4 float32 grid, origin (-4, 56), pixel size 0.25°, WGS84
// bbox: [-4, 55, -3, 56], nodata: -9999
// Values:
//   100, 110, 120, 130
//   105, 115, 125, 135
//   110, 120, -9999, 140
//   115, 125, 135, 145

describe("parseGeoTIFF", () => {
  it("extracts correct metadata from a WGS84 GeoTIFF", async () => {
    const file = loadFixtureAsFile("elevation.fixture.tif");
    const metadata = await parseGeoTIFF(file, fetchProj4DefFake);

    expect(metadata.width).toBe(4);
    expect(metadata.height).toBe(4);
    expect(metadata.bbox).toEqual([-4, 55, -3, 56]);
    expect(metadata.noDataValue).toBe(-9999);
    expect(metadata.file).toBe(file);
    expect(metadata.image).toBeDefined();
  });

  it("sets crsUnit to deg for WGS84 files", async () => {
    const file = loadFixtureAsFile("elevation.fixture.tif");
    const metadata = await parseGeoTIFF(file, fetchProj4DefFake);

    expect(metadata.crsUnit).toBe("deg");
  });

  it("defaults verticalUnit to m for WGS84 files", async () => {
    const file = loadFixtureAsFile("elevation.fixture.tif");
    const metadata = await parseGeoTIFF(file, fetchProj4DefFake);

    expect(metadata.verticalUnit).toBe("m");
  });

  it("does not set proj4Def for WGS84 files", async () => {
    const file = loadFixtureAsFile("elevation.fixture.tif");
    const metadata = await parseGeoTIFF(file, fetchProj4DefFake);

    expect(metadata.proj4Def).toBeUndefined();
  });

  it("extracts resolution from the file", async () => {
    const file = loadFixtureAsFile("elevation.fixture.tif");
    const metadata = await parseGeoTIFF(file, fetchProj4DefFake);

    expect(metadata.resolution).toEqual([0.25, 0.25]);
  });
});
