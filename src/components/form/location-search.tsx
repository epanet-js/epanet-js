import { useCallback } from "react";
import { env } from "src/lib/env-client";
import { captureError } from "src/infra/error-tracking";
import {
  SearchableSelector,
  type SearchableSelectorOption,
} from "./searchable-selector";

export type LocationData = {
  name: string;
  coordinates: [number, number];
  bbox: [number, number, number, number];
};

type MapboxFeature = {
  bbox: [number, number, number, number];
  center: [number, number];
  place_name: string;
  text: string;
  [key: string]: any;
};

type MapboxResponse = {
  features?: MapboxFeature[];
  [key: string]: any;
};

type LocationOption = SearchableSelectorOption & {
  data: LocationData;
};

export const LocationSearch = ({
  selected,
  onChange,
  placeholder = "Search location",
  disabled = false,
}: {
  selected?: LocationData;
  onChange: (location: LocationData) => void;
  placeholder?: string;
  disabled?: boolean;
}) => {
  const searchLocations = useCallback(
    async (query: string): Promise<LocationOption[]> => {
      if (!query.trim() || query.length < 2) {
        return [];
      }

      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            query,
          )}.json?access_token=${env.NEXT_PUBLIC_MAPBOX_TOKEN}&types=place,locality&limit=5`,
        );

        if (response.ok) {
          const data: MapboxResponse = await response.json();
          const features = data.features || [];

          return features
            .filter(isValidMapboxFeature)
            .map((feature: MapboxFeature) => ({
              id: feature.place_name || feature.text,
              label: feature.place_name || feature.text,
              data: {
                name: feature.place_name || feature.text,
                coordinates: feature.center as [number, number],
                bbox: feature.bbox as [number, number, number, number],
              },
            }));
        }
      } catch (error) {
        captureError(error as Error);
      }
      return [];
    },
    [],
  );

  return (
    <SearchableSelector
      selected={
        selected
          ? {
              id: selected.name,
              label: selected.name,
              data: selected,
            }
          : undefined
      }
      onChange={(option: LocationOption) => {
        onChange(option.data);
      }}
      onSearch={searchLocations}
      placeholder={placeholder}
      disabled={disabled}
      wrapperClassName="block"
    />
  );
};

const isValidMapboxFeature = (feature: unknown): feature is MapboxFeature => {
  if (!feature || typeof feature !== "object") {
    return false;
  }

  const obj = feature as Record<string, unknown>;

  return (
    "center" in obj &&
    "bbox" in obj &&
    Array.isArray(obj.center) &&
    Array.isArray(obj.bbox) &&
    ("place_name" in obj || "text" in obj) &&
    (typeof obj.place_name === "string" || typeof obj.text === "string")
  );
};
