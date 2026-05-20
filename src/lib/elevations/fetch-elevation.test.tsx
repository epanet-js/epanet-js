import { describe, it, expect, vi } from "vitest";
import {
  fetchElevationFromSources,
  fetchElevationsFromSources,
} from "./fetch-elevation";
import {
  fetchElevationForPoint,
  fetchElevationsForPoints,
} from "./tile-server-elevation";
import type {
  ElevationSource,
  GeoTiffElevationSource,
  TileServerElevationSource,
} from "./elevation-source-types";
import type { GeoTIFFImage } from "geotiff";

vi.mock("./tile-server-elevation", () => ({
  fetchElevationForPoint: vi.fn(),
  fetchElevationsForPoints: vi.fn(),
}));

const mockFetchMapbox = vi.mocked(fetchElevationForPoint);
const mockFetchMapboxBatch = vi.mocked(fetchElevationsForPoints);

const aTileServerSource = (
  overrides: Partial<TileServerElevationSource> = {},
): TileServerElevationSource => ({
  type: "tile-server",
  id: "mapbox",
  enabled: true,
  tileUrlTemplate: "https://example.com/{z}/{x}/{y}",
  tileZoom: 14,
  tileSize: 512,
  encoding: "terrain-rgb",
  elevationOffsetM: 0,
  ...overrides,
});

const aGeotiffSource = (
  overrides: Partial<GeoTiffElevationSource> = {},
): GeoTiffElevationSource => ({
  type: "geotiff",
  id: "geotiff-1",
  enabled: true,
  tiles: [
    {
      id: "tile-1",
      file: new File([""], "test.tif"),
      width: 4,
      height: 4,
      bbox: [-4, 55, -3, 56],
      resolution: [1, 1] as [number, number],
      crsUnit: "deg" as const,
      verticalUnit: "m" as const,
      pixelToCrs: [0, 1, 0, 0, 0, 1],
      crsToPixel: [16, 4, 0, 224, 0, -4],
      noDataValue: -9999,
      image: {
        readRasters: vi.fn().mockResolvedValue([new Float32Array([42.5])]),
      } as unknown as GeoTIFFImage,
    },
  ],
  elevationOffsetM: 0,
  ...overrides,
});

describe("fetchElevationFromSources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no sources are available", async () => {
    const result = await fetchElevationFromSources([], -3.5, 55.5, "m");
    expect(result).toBeNull();
  });

  it("returns null when all sources are disabled", async () => {
    const sources: ElevationSource[] = [
      aTileServerSource({ enabled: false }),
      aGeotiffSource({ enabled: false }),
    ];
    const result = await fetchElevationFromSources(sources, -3.5, 55.5, "m");
    expect(result).toBeNull();
  });

  it("returns elevation from a geotiff source", async () => {
    const sources: ElevationSource[] = [aGeotiffSource()];
    const result = await fetchElevationFromSources(sources, -3.5, 55.5, "m");
    expect(result).toBe(42.5);
  });

  it("returns elevation from a tile-server source", async () => {
    mockFetchMapbox.mockResolvedValue(100);
    const sources: ElevationSource[] = [aTileServerSource()];
    const result = await fetchElevationFromSources(sources, -3.5, 55.5, "m");
    expect(result).toBe(100);
  });

  it("applies elevationOffsetM to geotiff results", async () => {
    const sources: ElevationSource[] = [
      aGeotiffSource({ elevationOffsetM: 10 }),
    ];
    const result = await fetchElevationFromSources(sources, -3.5, 55.5, "m");
    expect(result).toBe(52.5); // 42.5 + 10
  });

  it("applies elevationOffsetM to tile-server results", async () => {
    mockFetchMapbox.mockResolvedValue(100);
    const sources: ElevationSource[] = [
      aTileServerSource({ elevationOffsetM: -5 }),
    ];
    const result = await fetchElevationFromSources(sources, -3.5, 55.5, "m");
    expect(result).toBe(95); // 100 + (-5)
  });

  it("iterates sources in reverse order (last = highest priority)", async () => {
    mockFetchMapbox.mockResolvedValue(100);
    const sources: ElevationSource[] = [
      aTileServerSource({ id: "mapbox" }),
      aGeotiffSource({ id: "geotiff-1" }),
    ];
    // GeoTIFF is last → tried first
    const result = await fetchElevationFromSources(sources, -3.5, 55.5, "m");
    expect(result).toBe(42.5);
    expect(mockFetchMapbox).not.toHaveBeenCalled();
  });

  it("falls back to next source when geotiff doesn't cover the point", async () => {
    mockFetchMapbox.mockResolvedValue(100);
    const sources: ElevationSource[] = [
      aTileServerSource(),
      aGeotiffSource(), // bbox: [-4, 55, -3, 56]
    ];
    // Point outside geotiff bbox → falls back to tile-server
    const result = await fetchElevationFromSources(sources, -10, 55.5, "m");
    expect(result).toBe(100);
    expect(mockFetchMapbox).toHaveBeenCalled();
  });

  it("falls back to next source when geotiff returns nodata", async () => {
    mockFetchMapbox.mockResolvedValue(100);
    const geotiff = aGeotiffSource();
    vi.mocked(geotiff.tiles[0].image.readRasters).mockResolvedValue([
      new Float32Array([-9999]),
    ] as any);

    const sources: ElevationSource[] = [aTileServerSource(), geotiff];
    const result = await fetchElevationFromSources(sources, -3.5, 55.5, "m");
    expect(result).toBe(100);
  });

  it("skips disabled sources", async () => {
    mockFetchMapbox.mockResolvedValue(100);
    const sources: ElevationSource[] = [
      aTileServerSource(),
      aGeotiffSource({ enabled: false }),
    ];
    const result = await fetchElevationFromSources(sources, -3.5, 55.5, "m");
    expect(result).toBe(100);
  });

  it("handles tile-server errors gracefully and tries next source", async () => {
    mockFetchMapbox.mockRejectedValue(new Error("Failed to fetch"));
    const geotiff = aGeotiffSource();

    // tile-server first (lower priority), geotiff last (higher priority, tried first)
    // but geotiff doesn't cover this point, so falls back to tile-server which errors
    const sources: ElevationSource[] = [
      aTileServerSource(),
      aGeotiffSource({
        tiles: [
          {
            ...geotiff.tiles[0],
            bbox: [10, 10, 11, 11], // doesn't cover -3.5, 55.5
          },
        ],
      }),
    ];
    const result = await fetchElevationFromSources(sources, -3.5, 55.5, "m");
    expect(result).toBeNull();
  });

  it("respects mixed source ordering", async () => {
    mockFetchMapbox.mockResolvedValue(100);
    // Two geotiff sources with a tile-server in between
    const geotiff1 = aGeotiffSource({ id: "geo-1" });
    vi.mocked(geotiff1.tiles[0].image.readRasters).mockResolvedValue([
      new Float32Array([10]),
    ] as any);

    const geotiff2 = aGeotiffSource({ id: "geo-2" });
    vi.mocked(geotiff2.tiles[0].image.readRasters).mockResolvedValue([
      new Float32Array([20]),
    ] as any);

    const sources: ElevationSource[] = [
      geotiff1, // tried last
      aTileServerSource(), // tried second
      geotiff2, // tried first (highest priority)
    ];
    const result = await fetchElevationFromSources(sources, -3.5, 55.5, "m");
    expect(result).toBe(20);
    expect(mockFetchMapbox).not.toHaveBeenCalled();
  });
});

const aGeotiffTile = (overrides: {
  id: string;
  bbox: [number, number, number, number];
  value: number;
}) => ({
  id: overrides.id,
  file: new File([""], `${overrides.id}.tif`),
  width: 4,
  height: 4,
  bbox: overrides.bbox,
  resolution: [1, 1] as [number, number],
  crsUnit: "deg" as const,
  verticalUnit: "m" as const,
  pixelToCrs: [overrides.bbox[0], 1, 0, overrides.bbox[3], 0, -1],
  // crsToPixel maps WGS84 lng/lat to pixel (col, row) within this tile
  crsToPixel: [
    -overrides.bbox[0] / 0.25,
    1 / 0.25,
    0,
    overrides.bbox[3] / 0.25,
    0,
    -1 / 0.25,
  ],
  noDataValue: -9999,
  image: {
    readRasters: vi.fn(({ window }: { window: number[] } = { window: [] }) => {
      const [x0, y0, x1, y1] = window;
      const size = Math.max(1, (x1 - x0) * (y1 - y0));
      return Promise.resolve([
        Float32Array.from({ length: size }, () => overrides.value),
      ]);
    }),
  } as unknown as GeoTIFFImage,
});

describe("fetchElevationsFromSources (batched)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array for no points", async () => {
    const result = await fetchElevationsFromSources([], [], "m");
    expect(result).toEqual([]);
  });

  it("resolves multiple points from a single geotiff tile in one read", async () => {
    const source: GeoTiffElevationSource = {
      type: "geotiff",
      id: "geo",
      enabled: true,
      tiles: [aGeotiffTile({ id: "t", bbox: [-4, 55, -3, 56], value: 42.5 })],
      elevationOffsetM: 0,
    };
    const readSpy = vi.mocked(source.tiles[0].image.readRasters);

    const result = await fetchElevationsFromSources(
      [source],
      [
        { lng: -3.5, lat: 55.5 },
        { lng: -3.6, lat: 55.6 },
        { lng: -3.7, lat: 55.7 },
      ],
      "m",
    );

    expect(result).toEqual([42.5, 42.5, 42.5]);
    expect(readSpy).toHaveBeenCalledTimes(1);
  });

  it("dispatches points to the tile that contains them", async () => {
    const tileWest = aGeotiffTile({
      id: "west",
      bbox: [-4, 55, -3, 56],
      value: 10,
    });
    const tileEast = aGeotiffTile({
      id: "east",
      bbox: [0, 55, 1, 56],
      value: 20,
    });
    const source: GeoTiffElevationSource = {
      type: "geotiff",
      id: "geo",
      enabled: true,
      tiles: [tileWest, tileEast],
      elevationOffsetM: 0,
    };

    const result = await fetchElevationsFromSources(
      [source],
      [
        { lng: -3.5, lat: 55.5 }, // west
        { lng: 0.5, lat: 55.5 }, // east
        { lng: -3.6, lat: 55.6 }, // west
      ],
      "m",
    );

    expect(result).toEqual([10, 20, 10]);
    expect(vi.mocked(tileWest.image.readRasters)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(tileEast.image.readRasters)).toHaveBeenCalledTimes(1);
  });

  it("returns null for points outside all tiles", async () => {
    const source: GeoTiffElevationSource = {
      type: "geotiff",
      id: "geo",
      enabled: true,
      tiles: [aGeotiffTile({ id: "t", bbox: [-4, 55, -3, 56], value: 10 })],
      elevationOffsetM: 0,
    };

    const result = await fetchElevationsFromSources(
      [source],
      [
        { lng: -3.5, lat: 55.5 }, // in tile
        { lng: 50, lat: 50 }, // outside
      ],
      "m",
    );

    expect(result).toEqual([10, null]);
  });

  it("falls back to a later tile in the same source when an earlier tile has no data", async () => {
    const tileNoData = aGeotiffTile({
      id: "no-data",
      bbox: [-4, 55, -3, 56],
      value: 10,
    });
    // Override to return nodata for any point in this tile
    vi.mocked(tileNoData.image.readRasters).mockResolvedValue([
      new Float32Array([-9999]),
    ] as any);

    const tileFallback = aGeotiffTile({
      id: "fallback",
      bbox: [-4, 55, -3, 56], // overlaps
      value: 99,
    });

    const source: GeoTiffElevationSource = {
      type: "geotiff",
      id: "geo",
      enabled: true,
      tiles: [tileNoData, tileFallback], // earlier tile wins on overlap, except nodata
      elevationOffsetM: 0,
    };

    const result = await fetchElevationsFromSources(
      [source],
      [{ lng: -3.5, lat: 55.5 }],
      "m",
    );

    expect(result).toEqual([99]);
  });

  it("applies source elevation offset to batched results", async () => {
    const source: GeoTiffElevationSource = {
      type: "geotiff",
      id: "geo",
      enabled: true,
      tiles: [aGeotiffTile({ id: "t", bbox: [-4, 55, -3, 56], value: 10 })],
      elevationOffsetM: 5,
    };

    const result = await fetchElevationsFromSources(
      [source],
      [{ lng: -3.5, lat: 55.5 }],
      "m",
    );

    expect(result).toEqual([15]);
  });

  it("falls back to tile-server source for points outside geotiff coverage", async () => {
    mockFetchMapboxBatch.mockResolvedValue([200]);
    const geotiff: GeoTiffElevationSource = {
      type: "geotiff",
      id: "geo",
      enabled: true,
      tiles: [aGeotiffTile({ id: "t", bbox: [-4, 55, -3, 56], value: 10 })],
      elevationOffsetM: 0,
    };

    const result = await fetchElevationsFromSources(
      [aTileServerSource(), geotiff],
      [
        { lng: -3.5, lat: 55.5 }, // resolved by geotiff (last = highest priority)
        { lng: 50, lat: 50 }, // outside geotiff → tile-server
      ],
      "m",
    );

    expect(result).toEqual([10, 200]);
    expect(mockFetchMapboxBatch).toHaveBeenCalledWith(
      [{ lng: 50, lat: 50 }],
      expect.any(Object),
    );
  });
});
