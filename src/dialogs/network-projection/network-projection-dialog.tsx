import { useCallback, useEffect, useRef, useState } from "react";
import type { FeatureCollection } from "geojson";
import {
  BaseDialog,
  SimpleDialogActions,
  useDialogState,
} from "src/components/dialog";
import type { LocationData } from "src/components/form/location-search";
import { isLikelyLatLng } from "src/lib/geojson-utils/coordinate-transform";
import { MapPreview } from "./map-preview";
import { ProjectionSearch } from "./projection-search";
import { ProjectionResults } from "./projection-results";
import { useProjections } from "./use-projections";
import { useMapPreview } from "./use-map-preview";
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
  const { fitToNetwork, fitToBbox, setHandle } = useMapPreview();

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
  const [showBasemap, setShowBasemap] = useState(false);
  const [projectionError, setProjectionError] = useState<string | null>(null);

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

  const applyProjection = useCallback(
    (
      projection: Projection,
      options: { fitNetwork: boolean; basemap: boolean },
    ) => {
      if (projectTimeoutRef.current) {
        clearTimeout(projectTimeoutRef.current);
        projectTimeoutRef.current = null;
      }

      setIsProjecting(true);
      projectTimeoutRef.current = setTimeout(() => {
        try {
          const projected = projectGeoJson(previewGeoJson, projection.code);
          if (isLikelyLatLng(projected)) {
            setDisplayGeoJSON(projected);
            setShowBasemap(options.basemap);
            setProjectionError(null);
            if (options.fitNetwork) {
              fitToNetwork(projected);
            }
          } else {
            const fallback = approximateToNullIsland(previewGeoJson);
            setDisplayGeoJSON(fallback);
            setShowBasemap(false);
            setProjectionError("Projection out of bounds");
            fitToNetwork(fallback);
          }
        } catch {
          const fallback = approximateToNullIsland(previewGeoJson);
          setDisplayGeoJSON(fallback);
          setShowBasemap(false);
          setProjectionError("Projection out of bounds");
          fitToNetwork(fallback);
        }
        setIsProjecting(false);
      }, 0);
    },
    [previewGeoJson, fitToNetwork],
  );

  const updateVisibleCandidates = useCallback(
    (bbox: Bbox, autoSelect: "first" | "keep") => {
      const visible = filterByViewport(allCandidatesRef.current, bbox);
      setVisibleCandidates(visible);

      if (visible.length > 0) {
        if (autoSelect === "first") {
          setSelectedProjection(visible[0].projection);
          applyProjection(visible[0].projection, {
            fitNetwork: true,
            basemap: true,
          });
        } else {
          setSelectedProjection((prev) => {
            const stillVisible =
              prev && visible.some((c) => c.projection.id === prev.id);
            if (stillVisible) return prev;
            const next = visible[0].projection;
            applyProjection(next, { fitNetwork: false, basemap: true });
            return next;
          });
        }
      } else {
        setSelectedProjection(null);
        setDisplayGeoJSON(null);
        setProjectionError(null);
      }
    },
    [applyProjection],
  );

  const handleLocationSelect = useCallback(
    (location: LocationData) => {
      setSelectedLocation(location);
      selectedLocationRef.current = location;
      setProjectionError(null);
      setShowBasemap(true);
      fitToBbox(location.bbox);
      updateVisibleCandidates(location.bbox, "first");
    },
    [updateVisibleCandidates, fitToBbox],
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
      applyProjection(projection, { fitNetwork: true, basemap: true });
    },
    [applyProjection],
  );

  const handleProjectionSelectFromResults = useCallback(
    (projection: Projection) => {
      setSelectedProjection(projection);
      applyProjection(projection, { fitNetwork: false, basemap: true });
    },
    [applyProjection],
  );

  const handleLoadWithoutBasemap = useCallback(() => {
    onImportNonProjected();
  }, [onImportNonProjected]);

  const isLoading = isBuilding || isProjecting;
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
          isDisabled={!selectedProjection || !!projectionError}
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
              {projectionError && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400 p-2 border border-red-200 dark:border-red-800 rounded-md bg-red-50 dark:bg-red-950 flex-shrink-0">
                  {projectionError}
                </p>
              )}
            </div>
          )}
        </div>
        <MapPreview
          setHandle={setHandle}
          geoJSON={displayGeoJSON}
          showBasemap={showBasemap}
          onBoundsChange={selectedLocation ? handleBoundsChange : undefined}
          isLoading={isLoading}
        />
      </div>
    </BaseDialog>
  );
};
