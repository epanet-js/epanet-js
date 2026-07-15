import { Mock, vi } from "vitest";
import * as useElevationsModule from "src/map/elevations/use-elevations";

vi.mock("src/map/elevations/use-elevations", () => ({
  useElevations: vi.fn(),
}));

export const stubElevation = (
  point?: { lng: number; lat: number },
  elevation?: number,
) => {
  const elevationAt = (lngLat: { lng: number; lat: number }) => {
    if (
      point &&
      elevation !== undefined &&
      lngLat.lng === point.lng &&
      lngLat.lat === point.lat
    ) {
      return elevation;
    }

    return 0;
  };

  const mockImpl = () => ({
    fetchElevation: vi
      .fn()
      .mockImplementation((lngLat: { lng: number; lat: number }) =>
        Promise.resolve(elevationAt(lngLat)),
      ),
    fetchElevations: vi
      .fn()
      .mockImplementation((lngLats: { lng: number; lat: number }[]) =>
        Promise.resolve(lngLats.map(elevationAt)),
      ),
    prefetchTileThrottled: vi.fn(),
  });

  (useElevationsModule.useElevations as Mock).mockImplementation(mockImpl);
};

export const stubElevationError = () => {
  const mockImpl = () => ({
    fetchElevation: vi
      .fn()
      .mockRejectedValue(new Error("Failed to fetch elevation")),
    fetchElevations: vi
      .fn()
      .mockRejectedValue(new Error("Failed to fetch elevation")),
    prefetchTileThrottled: vi.fn(),
  });

  (useElevationsModule.useElevations as Mock).mockImplementation(mockImpl);
};
