import { useCallback, useRef, useState } from "react";
import {
  BaseDialog,
  SimpleDialogActions,
  useDialogState,
} from "src/components/dialog";
import type { LocationData } from "src/components/form/location-search";
import { MapPreview, type MapPreviewHandle } from "./map-preview";
import { ProjectionSearch } from "./projection-search";
import { ProjectionResults } from "./projection-results";
import { useProjections } from "./use-projections";
import type { Projection } from "./types";

export const NetworkProjectionDialog = () => {
  const { closeDialog } = useDialogState();
  const mapPreviewRef = useRef<MapPreviewHandle>(null);
  const { projections } = useProjections();

  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(
    null,
  );
  const [selectedProjection, setSelectedProjection] =
    useState<Projection | null>(null);

  const handleLocationSelect = useCallback((location: LocationData) => {
    setSelectedLocation(location);
    setSelectedProjection(null);
    mapPreviewRef.current?.fitBounds(location.bbox);
  }, []);

  const handleProjectionSelectFromSearch = useCallback(
    (projection: Projection) => {
      setSelectedProjection(projection);
      setSelectedLocation(null);
    },
    [],
  );

  const handleProjectionSelectFromResults = useCallback(
    (projection: Projection) => {
      setSelectedProjection(projection);
    },
    [],
  );

  return (
    <BaseDialog
      title="Network projection"
      size="xxl"
      height="xxl"
      isOpen={true}
      onClose={closeDialog}
      footer={
        <SimpleDialogActions
          action="Add basemap"
          onAction={closeDialog}
          secondary={{ action: "Load without basemap", onClick: closeDialog }}
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
              projections={selectedLocation ? projections : []}
              selectedProjection={selectedProjection}
              onSelect={handleProjectionSelectFromResults}
            />
          )}
        </div>
        <MapPreview ref={mapPreviewRef} />
      </div>
    </BaseDialog>
  );
};
