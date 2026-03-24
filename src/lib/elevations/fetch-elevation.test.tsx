import { describe, it, expect, vi } from "vitest";
import { fetchElevationFromSources } from "./fetch-elevation";
import { fetchElevationForPoint } from "./tile-server-elevation";
import type {
  ElevationSource,
  GeoTiffElevationSource,
  TileServerElevationSource,
} from "./elevation-source-types";
import type { GeoTIFFImage } from "geotiff";

vi.mock("./tile-server-elevation", () => ({
  fetchElevationForPoint: vi.fn(),
}));

const mockFetchMapbox = vi.mocked(fetchElevationForPoint);

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
      pixelToGps: [0, 1, 0, 0, 0, 1],
      gpsToPixel: [16, 4, 0, 224, 0, -4],
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
