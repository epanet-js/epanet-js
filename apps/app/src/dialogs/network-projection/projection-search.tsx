import { useCallback, useRef } from "react";
import { MapPin, Sparkles } from "lucide-react";
import { captureError } from "src/infra/error-tracking";
import {
  SearchableSelector,
  type SearchableSelectorOption,
} from "@epanet-js/ui-kit";
import type { LocationData } from "src/components/form/location-search";
import { GeocodingError, searchLocations } from "src/lib/geocoding";
import type { Proj4Projection } from "src/lib/projections";
import { useTranslate } from "src/hooks/use-translate";
import {
  matchesProjection,
  hasExactProjectionMatch,
  projectionMatchRank,
} from "./match-projection";

const SEARCH_DEBOUNCE_MS = 300;

type SearchResultData =
  | { type: "location"; location: LocationData }
  | { type: "projection"; projection: Proj4Projection };

type SearchResult = SearchableSelectorOption & {
  data: SearchResultData;
};

export type SearchMetadata = {
  query: string;
  resultsCount: number;
  resultType: "location" | "projection";
};

export const ProjectionSearch = ({
  projections,
  onLocationSelect,
  onProjectionSelect,
  onSearched,
  onSearchError,
}: {
  projections: Proj4Projection[];
  onLocationSelect: (location: LocationData) => void;
  onProjectionSelect: (projection: Proj4Projection) => void;
  onSearched: (metadata: SearchMetadata) => void;
  onSearchError: (hasError: boolean) => void;
}) => {
  const t = useTranslate();
  const lastSearchRef = useRef<{ query: string; resultsCount: number }>({
    query: "",
    resultsCount: 0,
  });

  const search = useCallback(
    async (query: string): Promise<SearchResult[]> => {
      if (!query.trim() || query.length < 2) return [];

      const projectionResults: SearchResult[] = projections
        .filter((p) => matchesProjection(p, query))
        .sort(
          (a, b) =>
            projectionMatchRank(a, query) - projectionMatchRank(b, query),
        )
        .slice(0, 5)
        .map((p) => ({
          id: `proj-${p.id}`,
          label: `${p.name} ${p.id}`,
          data: { type: "projection" as const, projection: p },
        }));

      let locationResults: SearchResult[] = [];
      if (!hasExactProjectionMatch(projections, query)) {
        const locations = await doSearchLocations(query, onSearchError);
        locationResults = locations.map((location) => ({
          id: `loc-${location.name}`,
          label: location.name,
          data: { type: "location" as const, location },
        }));
      }

      const allResults = [...locationResults, ...projectionResults];
      lastSearchRef.current = { query, resultsCount: allResults.length };
      return allResults;
    },
    [projections, onSearchError],
  );

  const handleChange = useCallback(
    (option: SearchResult) => {
      onSearched({
        query: lastSearchRef.current.query,
        resultsCount: lastSearchRef.current.resultsCount,
        resultType: option.data.type,
      });
      if (option.data.type === "projection") {
        onProjectionSelect(option.data.projection);
      } else {
        onLocationSelect(option.data.location);
      }
    },
    [onLocationSelect, onProjectionSelect, onSearched],
  );

  const renderOption = useCallback((option: SearchResult) => {
    if (option.data.type === "location") {
      return (
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-subtle shrink-0" />
          <span>{option.data.location.name}</span>
        </div>
      );
    }
    return (
      <div className="flex items-start gap-2">
        <Sparkles className="w-4 h-4 text-subtle shrink-0 mt-0.5" />
        <div>
          <span className="block">{option.data.projection.name}</span>
          <span className="block text-size-small text-subtle">
            {option.data.projection.id}
          </span>
        </div>
      </div>
    );
  }, []);

  return (
    <SearchableSelector
      onChange={handleChange}
      onSearch={search}
      placeholder={t("networkProjection.searchPlaceholder")}
      wrapperClassName="block"
      autoFocus
      renderOption={renderOption}
      searchDebounceMs={SEARCH_DEBOUNCE_MS}
    />
  );
};

const doSearchLocations = async (
  query: string,
  onSearchError: (hasError: boolean) => void,
): Promise<LocationData[]> => {
  try {
    const locations = await searchLocations(query);
    onSearchError(false);
    return locations;
  } catch (error) {
    captureError(error as Error, {
      geocoding:
        error instanceof GeocodingError
          ? { query, status: error.status, responseBody: error.responseBody }
          : { query },
    });
    onSearchError(true);
    return [];
  }
};
