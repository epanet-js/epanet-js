import { describe, it, expect } from "vitest";
import { computeTileBoundaries, type BoundaryResult } from "./compute-boundary";
import { parseGeoTIFF } from "../parse-geotiff";
import { GeoTiffTile } from "../types";
import { buildFixture } from "src/__helpers__/geotiff-fixture";
import { GeoKey, ModelType, RasterType } from "../spec";

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

const fetchProj4Fake = vi.fn().mockResolvedValue("");

async function loadFixtureTile(
  overrides?: Partial<GeoTiffTile>,
): Promise<GeoTiffTile> {
  const file = elevationFixture();
  const metadata = await parseGeoTIFF(file, fetchProj4Fake);
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
