import type { ElevationEngine, ElevationGeoTiffCapability } from "./engine";
import type { GeoTiffTile } from "./types";

const bboxFeature = (tile: GeoTiffTile): GeoJSON.Feature => {
  const [west, south, east, north] = tile.bbox;
  return {
    type: "Feature",
    properties: { id: tile.id },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ],
      ],
    },
  };
};

const fakeGeoTiff: ElevationGeoTiffCapability = {
  parse: () => Promise.reject(new Error("geoTiff.parse was not stubbed")),
  computeBoundaries: () => Promise.resolve(),
  coverage: bboxFeature,
  resolution: () => ({ value: 1, unit: "m" }),
};

/**
 * A stand-in engine for tests that exercise elevation-dependent code without
 * pulling in a real engine. Every method is inert unless overridden.
 */
export type FakeElevationEngineOverrides = Partial<
  Omit<ElevationEngine, "geoTiff">
> & {
  geoTiff?: Partial<ElevationGeoTiffCapability>;
};

export const createFakeElevationEngine = (
  overrides: FakeElevationEngineOverrides = {},
): ElevationEngine => ({
  fetchElevation: () => Promise.resolve(null),
  fetchElevations: (_sources, points) =>
    Promise.resolve(points.map(() => null)),
  prefetchTile: () => Promise.resolve(),
  supportsGeoTiff: true,
  ...overrides,
  geoTiff: { ...fakeGeoTiff, ...overrides.geoTiff },
});
