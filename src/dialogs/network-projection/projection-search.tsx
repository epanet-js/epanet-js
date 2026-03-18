import { useCallback } from "react";
import { env } from "src/lib/env-client";
import { captureError } from "src/infra/error-tracking";
import {
  SearchableSelector,
  type SearchableSelectorOption,
} from "src/components/form/searchable-selector";
import type { LocationData } from "src/components/form/location-search";
import type { Projection } from "./types";

type SearchResultData =
  | { type: "location"; location: LocationData }
  | { type: "projection"; projection: Projection };

type SearchResult = SearchableSelectorOption & {
  data: SearchResultData;
};

export const ProjectionSearch = ({
  projections,
  onLocationSelect,
  onProjectionSelect,
}: {
  projections: Projection[];
  onLocationSelect: (location: LocationData) => void;
  onProjectionSelect: (projection: Projection) => void;
}) => {
  const search = useCallback(
    async (query: string): Promise<SearchResult[]> => {
      if (!query.trim() || query.length < 2) return [];

      const lowerQuery = query.toLowerCase();

      const projectionResults: SearchResult[] = projections
        .filter(
          (p) =>
            p.id.toLowerCase().includes(lowerQuery) ||
            p.name.toLowerCase().includes(lowerQuery),
        )
        .slice(0, 5)
        .map((p) => ({
          id: `proj-${p.id}`,
          label: `${p.name}  ${p.id}`,
          data: { type: "projection" as const, projection: p },
        }));

      let locationResults: SearchResult[] = [];
      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            query,
          )}.json?access_token=${env.NEXT_PUBLIC_MAPBOX_TOKEN}&types=place,locality&limit=5`,
        );

        if (response.ok) {
          const data = (await response.json()) as { features?: unknown[] };
          const features = (data.features || []).filter(isValidMapboxFeature);

          locationResults = features.map(
            (f: {
              place_name?: string;
              text?: string;
              center: number[];
              bbox: number[];
            }) => ({
              id: `loc-${f.place_name || f.text}`,
              label: f.place_name || f.text || "",
              data: {
                type: "location" as const,
                location: {
                  name: f.place_name || f.text || "",
                  coordinates: f.center as [number, number],
                  bbox: f.bbox as [number, number, number, number],
                },
              },
            }),
          );
        }
      } catch (error) {
        captureError(error as Error);
      }

      return [...projectionResults, ...locationResults];
    },
    [projections],
  );

  const handleChange = useCallback(
    (option: SearchResult) => {
      if (option.data.type === "projection") {
        onProjectionSelect(option.data.projection);
      } else {
        onLocationSelect(option.data.location);
      }
    },
    [onLocationSelect, onProjectionSelect],
  );

  return (
    <SearchableSelector
      onChange={handleChange}
      onSearch={search}
      placeholder="Search by location or code"
      wrapperClassName="block"
    />
  );
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
