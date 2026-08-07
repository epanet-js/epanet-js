import { describe, it, expect, vi, beforeEach } from "vitest";
import { defaultElevationEngine } from "./engine";
import { fetchElevationForPoint } from "./tile-server";
import type {
  ElevationSource,
  GeoTiffElevationSource,
  TileServerElevationSource,
} from "./types";

vi.mock("./tile-server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./tile-server")>()),
  fetchElevationForPoint: vi.fn(),
}));

const mockFetchPoint = vi.mocked(fetchElevationForPoint);

const aTileServerSource = (
  overrides: Partial<TileServerElevationSource> = {},
): TileServerElevationSource => ({
  type: "tile-server",
  id: "tiles",
  enabled: true,
  tileUrlTemplate: "https://example.com/{z}/{x}/{y}",
  tileZoom: 14,
  tileSize: 512,
  encoding: "terrain-rgb",
  elevationOffsetM: 0,
  ...overrides,
});

const aGeoTiffSource = (
  overrides: Partial<GeoTiffElevationSource> = {},
): GeoTiffElevationSource => ({
  type: "geotiff",
  id: "dtm",
  enabled: true,
  tiles: [],
  elevationOffsetM: 0,
  ...overrides,
});

describe("defaultElevationEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchElevation", () => {
    it("resolves a point from a tile-server source", async () => {
      mockFetchPoint.mockResolvedValue(100);

      const result = await defaultElevationEngine.fetchElevation(
        [aTileServerSource()],
        -3.5,
        55.5,
        "m",
      );

      expect(result).toBe(100);
    });

    it("applies the source offset", async () => {
      mockFetchPoint.mockResolvedValue(100);

      const result = await defaultElevationEngine.fetchElevation(
        [aTileServerSource({ elevationOffsetM: -5 })],
        -3.5,
        55.5,
        "m",
      );

      expect(result).toBe(95);
    });

    it("iterates sources in reverse order so the last one wins", async () => {
      mockFetchPoint.mockResolvedValue(100);

      const result = await defaultElevationEngine.fetchElevation(
        [
          aTileServerSource({
            tileUrlTemplate: "https://first.example/{z}/{x}/{y}",
            elevationOffsetM: 1000,
          }),
          aTileServerSource({
            tileUrlTemplate: "https://last.example/{z}/{x}/{y}",
            elevationOffsetM: 7,
          }),
        ],
        -3.5,
        55.5,
        "m",
      );

      // The last source's offset is the one applied, and only it was queried.
      expect(result).toBe(107);
      expect(mockFetchPoint).toHaveBeenCalledTimes(1);
      const options = mockFetchPoint.mock.calls[0][1];
      expect(options.tileServer?.tileUrlTemplate).toBe(
        "https://last.example/{z}/{x}/{y}",
      );
    });

    it("skips disabled sources", async () => {
      mockFetchPoint.mockResolvedValue(100);

      const result = await defaultElevationEngine.fetchElevation(
        [aTileServerSource({ enabled: false })],
        -3.5,
        55.5,
        "m",
      );

      expect(result).toBeNull();
      expect(mockFetchPoint).not.toHaveBeenCalled();
    });

    it("skips geotiff sources — this engine has no raster support", async () => {
      const result = await defaultElevationEngine.fetchElevation(
        [aGeoTiffSource()],
        -3.5,
        55.5,
        "m",
      );

      expect(result).toBeNull();
    });

    it("falls through to the next source when one fails", async () => {
      mockFetchPoint
        .mockRejectedValueOnce(new Error("Failed to fetch"))
        .mockResolvedValueOnce(42);

      const sources: ElevationSource[] = [
        aTileServerSource({ id: "fallback" }),
        aTileServerSource({ id: "primary" }),
      ];
      const result = await defaultElevationEngine.fetchElevation(
        sources,
        -3.5,
        55.5,
        "m",
      );

      expect(result).toBe(42);
    });

    it("returns null when there are no sources", async () => {
      expect(
        await defaultElevationEngine.fetchElevation([], -3.5, 55.5, "m"),
      ).toBeNull();
    });
  });

  describe("fetchElevations", () => {
    it("leaves every point unresolved — batching is not implemented here", async () => {
      const points = [
        { lng: -3.5, lat: 55.5 },
        { lng: -3.6, lat: 55.6 },
        { lng: -3.7, lat: 55.7 },
      ];

      const result = await defaultElevationEngine.fetchElevations(
        [aTileServerSource()],
        points,
        "m",
      );

      expect(result).toEqual([null, null, null]);
      expect(mockFetchPoint).not.toHaveBeenCalled();
    });

    it("returns an empty array for no points", async () => {
      expect(
        await defaultElevationEngine.fetchElevations(
          [aTileServerSource()],
          [],
          "m",
        ),
      ).toEqual([]);
    });
  });

  describe("geoTiff capability", () => {
    it("reports that it does not support geotiff", () => {
      expect(defaultElevationEngine.supportsGeoTiff).toBe(false);
    });

    it("throws rather than silently misreporting when asked to parse", async () => {
      await expect(
        defaultElevationEngine.geoTiff.parse(new File([""], "dtm.tif"), () =>
          Promise.resolve(null),
        ),
      ).rejects.toThrow(/does not support GeoTIFF/);
    });

    it("computes no boundaries without throwing", async () => {
      const onResult = vi.fn();
      await defaultElevationEngine.geoTiff.computeBoundaries(
        [],
        onResult,
        () => false,
      );
      expect(onResult).not.toHaveBeenCalled();
    });
  });
});
