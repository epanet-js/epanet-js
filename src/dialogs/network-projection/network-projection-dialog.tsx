import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import {
  BaseDialog,
  SimpleDialogActions,
  useDialogState,
} from "src/components/dialog";

const DEFAULT_CENTER: [number, number] = [-4.3800042, 55.914314];
const DEFAULT_ZOOM = 15.5;

export const NetworkProjectionDialog = () => {
  const { closeDialog } = useDialogState();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/light-v10",
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: false,
      interactive: false,
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
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
      <div className="flex-1 flex min-h-0">
        <div className="flex-shrink-0 w-[300px] border-r border-gray-200 p-4" />
        <div className="flex-1 min-h-0">
          <div ref={mapContainerRef} className="w-full h-full" />
        </div>
      </div>
    </BaseDialog>
  );
};
