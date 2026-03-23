import { useCallback, useMemo, useRef, useState } from "react";
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
  const locationBboxRef = useRef<Bbox | null>(null);

  const handleLocationSelect = useCallback(
    (location: LocationData) => {
      setSelectedLocation(location);
      locationBboxRef.current = location.bbox;

      const candidates = filterProjectionCandidates(
        projections,
        previewGeoJson,
        location.bbox,
      );
      setCandidateProjections(candidates);

      if (candidates.length > 0) {
        setSelectedProjection(candidates[0]);
      } else {
        setSelectedProjection(null);
      }
    },
    [projections, previewGeoJson],
  );

  const handleBoundsChange = useCallback(
    (viewportBbox: Bbox) => {
      if (!selectedLocation || !locationBboxRef.current) return;

      const initial = locationBboxRef.current;
      const zoomedBeyond =
        viewportBbox[0] < initial[0] ||
        viewportBbox[1] < initial[1] ||
        viewportBbox[2] > initial[2] ||
        viewportBbox[3] > initial[3];

      if (!zoomedBeyond) return;

      const candidates = filterProjectionCandidates(
        projections,
        previewGeoJson,
        viewportBbox,
      );
      setCandidateProjections(candidates);

      if (candidates.length > 0) {
        setSelectedProjection((prev) => {
          if (prev && candidates.some((c) => c.id === prev.id)) return prev;
          return candidates[0];
        });
      } else {
        setSelectedProjection(null);
      }
    },
    [projections, previewGeoJson, selectedLocation],
  );

  const handleProjectionSelectFromSearch = useCallback(
    (projection: Projection) => {
      setSelectedProjection(projection);
      setSelectedLocation(null);
      setCandidateProjections([]);
      locationBboxRef.current = null;
    },
    [],
  );

  const handleProjectionSelectFromResults = useCallback(
    (projection: Projection) => {
      setSelectedProjection(projection);
    },
    [],
  );

  const handleLoadWithoutBasemap = useCallback(() => {
    onImportNonProjected();
  }, [onImportNonProjected]);

  const displayGeoJSON = useMemo(() => {
    if (selectedProjection) {
      try {
        return projectGeoJson(previewGeoJson, selectedProjection.code);
      } catch {
        return null;
      }
    }
    if (!selectedLocation) {
      return approximateToNullIsland(previewGeoJson);
    }
    return null;
  }, [selectedProjection, selectedLocation, previewGeoJson]);

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
        />
      </div>
    </BaseDialog>
  );
};
