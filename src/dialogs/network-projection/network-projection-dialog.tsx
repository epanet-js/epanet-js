import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  buildProjectionCandidates,
  filterByViewport,
} from "./filter-projection-candidates";
import { projectGeoJson } from "./project-geojson";
import { approximateToNullIsland } from "./approximate-to-null-island";
import type { Bbox, Projection, ProjectionCandidate } from "./types";

const DEBOUNCE_MS = 200;

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
  const [visibleCandidates, setVisibleCandidates] = useState<
    ProjectionCandidate[]
  >([]);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isProjecting, setIsProjecting] = useState(false);
  const [displayGeoJSON, setDisplayGeoJSON] =
    useState<FeatureCollection | null>(() =>
      approximateToNullIsland(previewGeoJson),
    );

  const allCandidatesRef = useRef<ProjectionCandidate[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedLocationRef = useRef<LocationData | null>(null);

  useEffect(() => {
    if (projections.length === 0) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsBuilding(true);
    void buildProjectionCandidates(
      projections,
      previewGeoJson,
      controller.signal,
    ).then((candidates) => {
      if (controller.signal.aborted) return;
      allCandidatesRef.current = candidates;
      setIsBuilding(false);
    });

    return () => controller.abort();
  }, [projections, previewGeoJson]);

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

  const updateVisibleCandidates = useCallback(
    (bbox: Bbox, autoSelect: "first" | "keep") => {
      const visible = filterByViewport(allCandidatesRef.current, bbox);
      setVisibleCandidates(visible);

      const currentLocation = selectedLocationRef.current;
      if (visible.length > 0) {
        if (autoSelect === "first") {
          setSelectedProjection(visible[0].projection);
          updateDisplayGeoJSON(visible[0].projection, currentLocation);
        } else {
          setSelectedProjection((prev) => {
            const stillVisible =
              prev && visible.some((c) => c.projection.id === prev.id);
            if (stillVisible) return prev;
            const next = visible[0].projection;
            updateDisplayGeoJSON(next, currentLocation);
            return next;
          });
        }
      } else {
        setSelectedProjection(null);
        updateDisplayGeoJSON(null, currentLocation);
      }
    },
    [updateDisplayGeoJSON],
  );

  const handleLocationSelect = useCallback(
    (location: LocationData) => {
      setSelectedLocation(location);
      selectedLocationRef.current = location;
      updateVisibleCandidates(location.bbox, "first");
    },
    [updateVisibleCandidates],
  );

  const handleBoundsChange = useCallback(
    (viewportBbox: Bbox) => {
      if (!selectedLocationRef.current) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateVisibleCandidates(viewportBbox, "keep");
      }, DEBOUNCE_MS);
    },
    [updateVisibleCandidates],
  );

  const handleProjectionSelectFromSearch = useCallback(
    (projection: Projection) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setSelectedProjection(projection);
      setSelectedLocation(null);
      selectedLocationRef.current = null;
      setVisibleCandidates([]);
      updateDisplayGeoJSON(projection, null);
    },
    [updateDisplayGeoJSON],
  );

  const handleProjectionSelectFromResults = useCallback(
    (projection: Projection) => {
      setSelectedProjection(projection);
      updateDisplayGeoJSON(projection, selectedLocationRef.current);
    },
    [updateDisplayGeoJSON],
  );

  const handleLoadWithoutBasemap = useCallback(() => {
    onImportNonProjected();
  }, [onImportNonProjected]);

  const isLoading = isBuilding || isProjecting;
  const showBasemap = !!selectedLocation;
  const fitBbox = selectedLocation?.bbox ?? null;
  const candidateProjections = visibleCandidates.map((c) => c.projection);

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
        <div className="flex-shrink-0 w-[300px] border-r border-gray-200 dark:border-gray-700 p-4 flex flex-col min-h-0">
          <ProjectionSearch
            projections={projections}
            onLocationSelect={handleLocationSelect}
            onProjectionSelect={handleProjectionSelectFromSearch}
          />

          {(selectedLocation || selectedProjection) && (
            <div className="flex-1 min-h-0 flex flex-col">
              <ProjectionResults
                projections={selectedLocation ? candidateProjections : []}
                selectedProjection={selectedProjection}
                onSelect={handleProjectionSelectFromResults}
                isLoading={isBuilding}
                emptyMessage={
                  selectedLocation
                    ? "No matching projections found for this location"
                    : undefined
                }
              />
            </div>
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
