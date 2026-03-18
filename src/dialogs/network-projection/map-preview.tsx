import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { env } from "src/lib/env-client";

const DEFAULT_CENTER: [number, number] = [-4.3800042, 55.914314];
const DEFAULT_ZOOM = 15.5;

export type MapPreviewHandle = {
  fitBounds: (bbox: [number, number, number, number]) => void;
};

export const MapPreview = forwardRef<MapPreviewHandle>(
  function MapPreview(_props, ref) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);

    useImperativeHandle(ref, () => ({
      fitBounds: (bbox) => {
        mapRef.current?.fitBounds(bbox, { padding: 50, animate: false });
      },
    }));

    const initMap = useCallback(() => {
      if (!mapContainerRef.current) return;

      mapRef.current?.remove();

      mapboxgl.accessToken = env.NEXT_PUBLIC_MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/light-v10",
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        attributionControl: false,
        boxZoom: false,
        dragRotate: false,
        doubleClickZoom: false,
      });

      map.on("load", () => {
        map.resize();
      });

      mapRef.current = map;
    }, []);

    useEffect(() => {
      initMap();

      return () => {
        mapRef.current?.remove();
        mapRef.current = null;
      };
    }, [initMap]);

    return (
      <div className="relative flex-1 flex flex-col min-h-0">
        <div ref={mapContainerRef} className="flex-1 w-full" />
      </div>
    );
  },
);
