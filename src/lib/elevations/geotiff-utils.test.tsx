import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  transformCoordinates,
  isPointInBbox,
  sampleElevation,
  extractGeoTiffMetadata,
  getGeoTiffGridResolution,
  UnsupportedProjectionError,
} from "./geotiff-utils";
import type {
  GeoTiffTile,
  GeoTiffElevationSource,
} from "./elevation-source-types";
import type { GeoTIFFImage } from "geotiff";

function loadFixtureAsFile(filename: string): File {
  const buffer = fs.readFileSync(path.join(__dirname, filename));
  return new File([new Uint8Array(buffer)], filename, { type: "image/tiff" });
}

async function loadFixtureTile(
  overrides?: Partial<GeoTiffTile>,
): Promise<GeoTiffTile> {
  const file = loadFixtureAsFile("elevation.fixture.tif");
  const metadata = await extractGeoTiffMetadata(file);
  return { id: "test", ...metadata, ...overrides };
}

describe("transformCoordinates", () => {
  const identityMatrix = [0, 1, 0, 0, 0, 1];

  it("applies identity matrix", () => {
    expect(transformCoordinates(5, 10, identityMatrix)).toEqual([5, 10]);
  });

  it("applies scale and offset", () => {
    const matrix = [100, 0.5, 0, 200, 0, -0.5];
    expect(transformCoordinates(3, 4, matrix)).toEqual([101.5, 198]);
  });

  it("rounds to integer when requested", () => {
    const matrix = [0.5, 1, 0, 0.7, 0, 1];
    expect(transformCoordinates(2, 3, matrix, true)).toEqual([2, 3]);
  });

  it("handles shear terms", () => {
    const matrix = [0, 1, 0.5, 0, 0.5, 1];
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

// Fixture: 4x4 float32 grid, origin (-4, 56), pixel size 0.25°, WGS84
// bbox: [-4, 55, -3, 56], nodata: -9999
// Values:
//   100, 110, 120, 130
//   105, 115, 125, 135
//   110, 120, -9999, 140
//   115, 125, 135, 145

describe("extractGeoTiffMetadata", () => {
  it("extracts correct metadata from a WGS84 GeoTIFF", async () => {
    const file = loadFixtureAsFile("elevation.fixture.tif");
    const metadata = await extractGeoTiffMetadata(file);

    expect(metadata.width).toBe(4);
    expect(metadata.height).toBe(4);
    expect(metadata.bbox).toEqual([-4, 55, -3, 56]);
    expect(metadata.noDataValue).toBe(-9999);
    expect(metadata.file).toBe(file);
    expect(metadata.image).toBeDefined();
  });

  it("sets crsUnit to deg for WGS84 files", async () => {
    const file = loadFixtureAsFile("elevation.fixture.tif");
    const metadata = await extractGeoTiffMetadata(file);

    expect(metadata.crsUnit).toBe("deg");
  });

  it("defaults verticalUnit to m for WGS84 files", async () => {
    const file = loadFixtureAsFile("elevation.fixture.tif");
    const metadata = await extractGeoTiffMetadata(file);

    expect(metadata.verticalUnit).toBe("m");
  });

  it("does not set proj4Def for WGS84 files", async () => {
    const file = loadFixtureAsFile("elevation.fixture.tif");
    const metadata = await extractGeoTiffMetadata(file);

    expect(metadata.proj4Def).toBeUndefined();
  });

  it("extracts resolution from the file", async () => {
    const file = loadFixtureAsFile("elevation.fixture.tif");
    const metadata = await extractGeoTiffMetadata(file);

    expect(metadata.resolution).toEqual([0.25, 0.25]);
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

  it("converts elevation to the requested unit", async () => {
    const tile = await loadFixtureTile();

    // Pixel (0,0) = 100m → ft
    const inFeet = await sampleElevation(tile, -3.875, 55.875, "ft");
    expect(inFeet).toBeCloseTo(328.084, 1);
  });

  it("applies scaleZ to raw pixel values", async () => {
    const tile = await loadFixtureTile({ scaleZ: 0.1 });

    // Pixel (0,0) raw = 100, scaled = 10m
    expect(await sampleElevation(tile, -3.875, 55.875)).toBe(10);
  });

  it("converts from vertical unit when set", async () => {
    const tile = await loadFixtureTile({ verticalUnit: "ft" });

    // Pixel (0,0) = 100ft → m
    const inMeters = await sampleElevation(tile, -3.875, 55.875, "m");
    expect(inMeters).toBeCloseTo(30.48, 1);
  });

  it("skips conversion when vertical unit matches target", async () => {
    const tile = await loadFixtureTile({ verticalUnit: "ft" });

    const inFeet = await sampleElevation(tile, -3.875, 55.875, "ft");
    expect(inFeet).toBe(100);
  });
});

describe("getGeoTiffGridResolution", () => {
  const makeSource = (
    tileOverrides: Partial<GeoTiffTile> = {},
  ): GeoTiffElevationSource => ({
    type: "geotiff",
    id: "src-1",
    enabled: true,
    tiles: [
      {
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
        ...tileOverrides,
      },
    ],
    elevationOffsetM: 0,
  });

  it("returns 0 for an empty source", () => {
    const source: GeoTiffElevationSource = {
      type: "geotiff",
      id: "empty",
      enabled: true,
      tiles: [],
      elevationOffsetM: 0,
    };
    expect(getGeoTiffGridResolution(source)).toBe(0);
  });

  it("converts degrees to meters for geographic CRS", () => {
    const source = makeSource();
    const resolution = getGeoTiffGridResolution(source, "m");

    // 0.00025° ≈ 15.9m at 55° latitude
    expect(resolution).toBeCloseTo(15.9, 0);
  });

  it("returns resolution in CRS units for projected CRS in meters", () => {
    const source = makeSource({
      proj4Def: "+proj=tmerc +ellps=GRS80 +units=m",
      crsUnit: "m",
      resolution: [1, 1],
    });
    expect(getGeoTiffGridResolution(source, "m")).toBe(1);
  });

  it("converts feet to meters for projected CRS in feet", () => {
    const source = makeSource({
      proj4Def: "+proj=tmerc +ellps=GRS80 +units=us-ft",
      crsUnit: "us-ft",
      resolution: [5, 5],
    });
    const resolution = getGeoTiffGridResolution(source, "m");
    expect(resolution).toBeCloseTo(1.524, 2);
  });

  it("returns feet directly when target unit is feet", () => {
    const source = makeSource({
      proj4Def: "+proj=tmerc +ellps=GRS80 +units=us-ft",
      crsUnit: "us-ft",
      resolution: [5, 5],
    });
    const resolution = getGeoTiffGridResolution(source, "ft");
    expect(resolution).toBeCloseTo(5, 0);
  });
});

describe("UnsupportedProjectionError", () => {
  it("includes EPSG code in message", () => {
    const error = new UnsupportedProjectionError("test.tif", {
      isProjected: true,
      epsgCode: 9999,
    });
    expect(error.message).toContain("EPSG:9999");
    expect(error.fileName).toBe("test.tif");
  });

  it("indicates user-defined projection in message", () => {
    const error = new UnsupportedProjectionError("test.tif", {
      isProjected: true,
      isUserDefined: true,
    });
    expect(error.message).toContain("user-defined");
  });
});
