import { Mock, vi } from "vitest";
import * as useElevationsModule from "src/map/elevations/use-elevations";

vi.mock("src/map/elevations/use-elevations", () => ({
  useElevations: vi.fn(),
}));

export const stubElevation = (
  point?: { lng: number; lat: number },
  elevation?: number,
) => {
  const mockImpl = () => ({
    fetchElevation: vi
      .fn()
      .mockImplementation((lngLat: { lng: number; lat: number }) => {
        if (
          point &&
          elevation !== undefined &&
          lngLat.lng === point.lng &&
          lngLat.lat === point.lat
        ) {
          return Promise.resolve(elevation);
        }

        return Promise.resolve(0);
      }),
    prefetchTile: vi.fn(),
  });

  (useElevationsModule.useElevations as Mock).mockImplementation(mockImpl);
};

export const stubElevationError = () => {
  const mockImpl = () => ({
    fetchElevation: vi
      .fn()
      .mockRejectedValue(new Error("Failed to fetch elevation")),
    prefetchTile: vi.fn(),
  });

  (useElevationsModule.useElevations as Mock).mockImplementation(mockImpl);
};
