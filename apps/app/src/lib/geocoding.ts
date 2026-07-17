import { QueryClient } from "@tanstack/query-core";
import { env } from "src/lib/env-client";

export type GeocodingResult = {
  name: string;
  coordinates: [number, number];
  bbox: [number, number, number, number];
};

export class GeocodingError extends Error {
  readonly status: number;
  readonly responseBody: string;

  constructor(status: number, responseBody: string) {
    super(`Geocoding request failed with status ${status}`);
    this.name = "GeocodingError";
    this.status = status;
    this.responseBody = responseBody;
  }
}

const maxRetries = 3;
const retryDelayMs = 100;
const staleTime = 5 * 60 * 1000;

const isRetryable = (error: unknown): boolean =>
  !(error instanceof GeocodingError) || error.status >= 500;

export const geocodingQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime,
      retry: (failureCount, error) =>
        failureCount < maxRetries && isRetryable(error),
      retryDelay: retryDelayMs,
    },
  },
});

export const searchLocations = (query: string): Promise<GeocodingResult[]> =>
  geocodingQueryClient.fetchQuery({
    queryKey: ["geocoding", query],
    queryFn: () => fetchLocations(query),
  });

const fetchLocations = async (query: string): Promise<GeocodingResult[]> => {
  const response = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      query,
    )}.json?access_token=${env.NEXT_PUBLIC_MAPBOX_TOKEN}&types=place,locality&limit=5`,
  );

  if (!response.ok) {
    throw new GeocodingError(response.status, await readBody(response));
  }

  const data = (await response.json()) as { features?: unknown[] };
  return (data.features || []).filter(isValidMapboxFeature).map((feature) => ({
    name: feature.place_name || feature.text || "",
    coordinates: feature.center as [number, number],
    bbox: feature.bbox as [number, number, number, number],
  }));
};

const readBody = async (response: Response): Promise<string> => {
  try {
    return await response.text();
  } catch {
    return "";
  }
};

const isValidMapboxFeature = (
  feature: unknown,
): feature is {
  center: number[];
  bbox: number[];
  place_name?: string;
  text?: string;
} => {
  if (!feature || typeof feature !== "object") return false;
  const obj = feature as Record<string, unknown>;
  return (
    "center" in obj &&
    "bbox" in obj &&
    Array.isArray(obj.center) &&
    Array.isArray(obj.bbox) &&
    ("place_name" in obj || "text" in obj)
  );
};
