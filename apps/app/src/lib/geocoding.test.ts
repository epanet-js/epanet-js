import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  GeocodingError,
  geocodingQueryClient,
  searchLocations,
} from "./geocoding";

const aFeature = {
  place_name: "Valencia, Spain",
  center: [-0.37, 39.46],
  bbox: [-0.43, 39.28, -0.27, 39.56],
};

const successResponse = (features: unknown[] = [aFeature]) =>
  ({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ features }),
  }) as unknown as Response;

const errorResponse = (status: number, body = "") =>
  ({
    ok: false,
    status,
    text: () => Promise.resolve(body),
  }) as unknown as Response;

describe("searchLocations", () => {
  beforeEach(() => {
    geocodingQueryClient.clear();
    vi.restoreAllMocks();
  });

  it("maps mapbox features to results", async () => {
    global.fetch = vi.fn().mockResolvedValue(successResponse());

    const results = await searchLocations("valencia");

    expect(results).toEqual([
      {
        name: "Valencia, Spain",
        coordinates: [-0.37, 39.46],
        bbox: [-0.43, 39.28, -0.27, 39.56],
      },
    ]);
  });

  it("serves repeated queries from the cache", async () => {
    global.fetch = vi.fn().mockResolvedValue(successResponse());

    await searchLocations("madrid");
    await searchLocations("madrid");

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("retries network errors and recovers", async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue(successResponse());

    const results = await searchLocations("lisbon");

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(1);
  });

  it("retries server errors up to 3 times before failing", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(errorResponse(500, "Internal Server Error"));

    const error = await searchLocations("paris").catch((e: unknown) => e);

    expect(global.fetch).toHaveBeenCalledTimes(4);
    expect(error).toBeInstanceOf(GeocodingError);
    expect((error as GeocodingError).status).toBe(500);
    expect((error as GeocodingError).responseBody).toBe(
      "Internal Server Error",
    );
  });

  it("does not retry client errors", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(errorResponse(401, "Not Authorized - Invalid Token"));

    const error = await searchLocations("berlin").catch((e: unknown) => e);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(error).toBeInstanceOf(GeocodingError);
    expect((error as GeocodingError).status).toBe(401);
    expect((error as GeocodingError).responseBody).toBe(
      "Not Authorized - Invalid Token",
    );
  });

  it("filters out malformed features", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        successResponse([aFeature, { place_name: "No bbox" }]),
      );

    const results = await searchLocations("rome");

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Valencia, Spain");
  });
});
