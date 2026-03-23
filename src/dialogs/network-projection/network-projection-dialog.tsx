import { useCallback, useRef, useState } from "react";
import type { FeatureCollection } from "geojson";
import {
  BaseDialog,
  SimpleDialogActions,
  useDialogState,
} from "src/components/dialog";
import type { LocationData } from "src/components/form/location-search";
import { MapPreview } from "./map-preview";
import { ProjectionSearch } from "./projection-search";
import { ProjectionResults } from "./projection-results";
import { useProjections } from "./use-projections";
import { filterProjectionCandidates } from "./filter-projection-candidates";
import { projectGeoJson } from "./project-geojson";
import { approximateToNullIsland } from "./approximate-to-null-island";
import type { Projection } from "./types";

type Bbox = [number, number, number, number];

const DEBOUNCE_MS = 300;

export const NetworkProjectionDialog = ({
  previewGeoJson,
  onImportNonProjected,
}: {
  previewGeoJson: FeatureCollection;
  onImportNonProjected: () => void;
}) => {
  const { closeDialog } = useDialogState();
  const { projections } = useProjections();

  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(
    null,
  );
  const [selectedProjection, setSelectedProjection] =
    useState<Projection | null>(null);
  const [candidateProjections, setCandidateProjections] = useState<
    Projection[]
  >([]);
  const [isFiltering, setIsFiltering] = useState(false);
  const [isProjecting, setIsProjecting] = useState(false);
  const [displayGeoJSON, setDisplayGeoJSON] =
    useState<FeatureCollection | null>(() =>
      approximateToNullIsland(previewGeoJson),
    );

  const selectedLocationRef = useRef<LocationData | null>(null);
  const maxBboxRef = useRef<Bbox | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateDisplayGeoJSON = useCallback(
    (projection: Projection | null, location: LocationData | null) => {
      if (projectTimeoutRef.current) {
        clearTimeout(projectTimeoutRef.current);
        projectTimeoutRef.current = null;
      }

      if (projection) {
        setIsProjecting(true);
        projectTimeoutRef.current = setTimeout(() => {
          try {
            setDisplayGeoJSON(projectGeoJson(previewGeoJson, projection.code));
          } catch {
            setDisplayGeoJSON(null);
          }
          setIsProjecting(false);
        }, 0);
        return;
      }

      if (!location) {
        setDisplayGeoJSON(approximateToNullIsland(previewGeoJson));
      } else {
        setDisplayGeoJSON(null);
      }
      setIsProjecting(false);
    },
    [previewGeoJson],
  );

  const runFilter = useCallback(
    async (bbox: Bbox, autoSelect: "first" | "keep") => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsFiltering(true);

      const candidates = await filterProjectionCandidates(
        projections,
        previewGeoJson,
        bbox,
        controller.signal,
      );

      if (controller.signal.aborted) return;

      setCandidateProjections(candidates);
      setIsFiltering(false);

      const currentLocation = selectedLocationRef.current;
      if (candidates.length > 0) {
        if (autoSelect === "first") {
          setSelectedProjection(candidates[0]);
          updateDisplayGeoJSON(candidates[0], currentLocation);
        } else {
          setSelectedProjection((prev) => {
            const kept =
              prev && candidates.some((c) => c.id === prev.id)
                ? prev
                : candidates[0];
            updateDisplayGeoJSON(kept, currentLocation);
            return kept;
          });
        }
      } else {
        setSelectedProjection(null);
        updateDisplayGeoJSON(null, currentLocation);
      }
    },
    [projections, previewGeoJson, updateDisplayGeoJSON],
  );

  const handleLocationSelect = useCallback(
    (location: LocationData) => {
      setSelectedLocation(location);
      selectedLocationRef.current = location;
      maxBboxRef.current = location.bbox;
      void runFilter(location.bbox, "first");
    },
    [runFilter],
  );

  const handleBoundsChange = useCallback(
    (viewportBbox: Bbox) => {
      const max = maxBboxRef.current;
      if (!max) return;

      const noOverlap =
        viewportBbox[2] < max[0] ||
        viewportBbox[0] > max[2] ||
        viewportBbox[3] < max[1] ||
        viewportBbox[1] > max[3];

      if (noOverlap) {
        maxBboxRef.current = viewportBbox;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          void runFilter(viewportBbox, "first");
        }, DEBOUNCE_MS);
        return;
      }

      const within =
        viewportBbox[0] >= max[0] &&
        viewportBbox[1] >= max[1] &&
        viewportBbox[2] <= max[2] &&
        viewportBbox[3] <= max[3];

      if (within) return;

      maxBboxRef.current = [
        Math.min(max[0], viewportBbox[0]),
        Math.min(max[1], viewportBbox[1]),
        Math.max(max[2], viewportBbox[2]),
        Math.max(max[3], viewportBbox[3]),
      ];

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void runFilter(maxBboxRef.current!, "keep");
      }, DEBOUNCE_MS);
    },
    [runFilter],
  );

  const handleProjectionSelectFromSearch = useCallback(
    (projection: Projection) => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setSelectedProjection(projection);
      setSelectedLocation(null);
      selectedLocationRef.current = null;
      setCandidateProjections([]);
      setIsFiltering(false);
      maxBboxRef.current = null;
      updateDisplayGeoJSON(projection, null);
    },
    [updateDisplayGeoJSON],
  );

  const handleProjectionSelectFromResults = useCallback(
    (projection: Projection) => {
      setSelectedProjection(projection);
      updateDisplayGeoJSON(projection, selectedLocation);
    },
    [selectedLocation, updateDisplayGeoJSON],
  );

  const handleLoadWithoutBasemap = useCallback(() => {
    onImportNonProjected();
  }, [onImportNonProjected]);

  const isLoading = isFiltering || isProjecting;
  const showBasemap = !!selectedLocation;
  const fitBbox = selectedLocation?.bbox ?? null;

  return (
    <BaseDialog
      title="Network projection"
      size="xxl"
      height="xxl"
      isOpen={true}
      onClose={closeDialog}
      footer={
        <SimpleDialogActions
          action="Apply basemap"
          isDisabled={!selectedProjection}
          secondary={{
            action: "Load without basemap",
            onClick: handleLoadWithoutBasemap,
          }}
        />
      }
    >
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-shrink-0 w-[300px] border-r border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
          <ProjectionSearch
            projections={projections}
            onLocationSelect={handleLocationSelect}
            onProjectionSelect={handleProjectionSelectFromSearch}
          />

          {(selectedLocation || selectedProjection) && (
            <ProjectionResults
              projections={selectedLocation ? candidateProjections : []}
              selectedProjection={selectedProjection}
              onSelect={handleProjectionSelectFromResults}
              isLoading={isFiltering}
              emptyMessage={
                selectedLocation
                  ? "No matching projections found for this location"
                  : undefined
              }
            />
          )}
        </div>
        <MapPreview
          geoJSON={displayGeoJSON}
          showBasemap={showBasemap}
          bbox={fitBbox}
          onBoundsChange={selectedLocation ? handleBoundsChange : undefined}
          isLoading={isLoading}
        />
      </div>
    </BaseDialog>
  );
};
