import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { computeTileBoundaries, type BoundaryResult } from "./compute-boundary";
import { extractGeoTiffMetadata } from "./geotiff-utils";
import type { GeoTiffTile } from "./elevation-source-types";

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

function collectResults(
  tiles: GeoTiffTile[],
  isCancelled = (_id: string) => false,
) {
  const results: BoundaryResult[] = [];
  const promise = computeTileBoundaries(
    tiles,
    (result) => results.push(result),
    isCancelled,
  );
  return { results, promise };
}

// Fixture: 4x4 float32 grid, origin (-4, 56), pixel size 0.25°
// bbox: [-4, 55, -3, 56], nodata: -9999
// Values:
//   100, 110, 120, 130
//   105, 115, 125, 135
//   110, 120, -9999, 140
//   115, 125, 135, 145

describe("computeTileBoundaries", () => {
  it("returns a polygon geometry for a tile with valid data", async () => {
    const tile = await loadFixtureTile();
    const { results, promise } = collectResults([tile]);
    await promise;

    expect(results).toHaveLength(1);
    expect(results[0].tileId).toBe("test");
    expect(results[0].polygon).not.toBeNull();
    expect(results[0].polygon!.type).toBe("Polygon");
  });

  it("returns a closed polygon ring", async () => {
    const tile = await loadFixtureTile();
    const { results, promise } = collectResults([tile]);
    await promise;

    const coords = (results[0].polygon as GeoJSON.Polygon).coordinates[0];
    expect(coords[0]).toEqual(coords[coords.length - 1]);
  });

  it("returns a polygon when noDataValue is null", async () => {
    const tile = await loadFixtureTile({ noDataValue: null });
    const { results, promise } = collectResults([tile]);
    await promise;

    expect(results).toHaveLength(1);
    expect(results[0].polygon).not.toBeNull();
    expect(results[0].polygon!.type).toBe("Polygon");
  });

  it("returns null polygon for a tile with fewer than 3 valid rows", async () => {
    const tile = await loadFixtureTile({ height: 2 });
    const { results, promise } = collectResults([tile]);
    await promise;

    expect(results).toHaveLength(1);
    expect(results[0].polygon).toBeNull();
  });

  it("skips cancelled tiles", async () => {
    const tile1 = await loadFixtureTile({ id: "tile-1" });
    const tile2 = await loadFixtureTile({ id: "tile-2" });
    const { results, promise } = collectResults(
      [tile1, tile2],
      (id) => id === "tile-1",
    );
    await promise;

    expect(results).toHaveLength(1);
    expect(results[0].tileId).toBe("tile-2");
  });

  it("processes multiple tiles in sequence", async () => {
    const tile1 = await loadFixtureTile({ id: "tile-1" });
    const tile2 = await loadFixtureTile({ id: "tile-2" });
    const { results, promise } = collectResults([tile1, tile2]);
    await promise;

    expect(results).toHaveLength(2);
    expect(results[0].tileId).toBe("tile-1");
    expect(results[1].tileId).toBe("tile-2");
  });
});
