import { useCallback, useRef } from "react";
import {
  BaseDialog,
  SimpleDialogActions,
  useDialogState,
} from "src/components/dialog";
import {
  LocationSearch,
  type LocationData,
} from "src/components/form/location-search";
import { MapPreview, type MapPreviewHandle } from "./map-preview";

export const NetworkProjectionDialog = () => {
  const { closeDialog } = useDialogState();
  const mapPreviewRef = useRef<MapPreviewHandle>(null);

  const handleLocationChange = useCallback((location: LocationData) => {
    mapPreviewRef.current?.fitBounds(location.bbox);
  }, []);

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
        <div className="flex-shrink-0 w-[300px] border-r border-gray-200 p-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Location
          </label>
          <LocationSearch onChange={handleLocationChange} />
        </div>
        <MapPreview ref={mapPreviewRef} />
      </div>
    </BaseDialog>
  );
};
